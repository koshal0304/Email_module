// =============================================================================
// Authentication Service
// =============================================================================
// Microsoft OAuth 2.0 authentication with Azure AD
// =============================================================================

import axios from 'axios';
import { config } from '../config';
import { prisma } from '../config/database';
import { encryptToken, decryptToken } from '../utils/encryption';
import { AuthenticationError, GraphApiError } from '../utils/exceptions';
import { generateToken } from '../middleware/auth';
import { AuthTokens, GraphUser, AuthenticatedUser } from '../types';

// =============================================================================
// OAuth URL Generation
// =============================================================================

/**
 * Generates the Microsoft OAuth 2.0 authorization URL
 */
export function getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
        client_id: config.azure.clientId,
        response_type: 'code',
        redirect_uri: config.azure.redirectUri,
        scope: config.graph.scopeString,
        response_mode: 'query',
        prompt: 'select_account',
    });

    if (state) {
        params.append('state', state);
    }

    return `${config.azure.authorizationEndpoint}?${params.toString()}`;
}

// =============================================================================
// Token Exchange
// =============================================================================

/**
 * Exchanges authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<AuthTokens> {
    try {
        const response = await axios.post(
            config.azure.tokenEndpoint,
            new URLSearchParams({
                client_id: config.azure.clientId,
                client_secret: config.azure.clientSecret,
                code,
                redirect_uri: config.azure.redirectUri,
                grant_type: 'authorization_code',
                scope: config.graph.scopeString,
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        return {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            expiresIn: response.data.expires_in,
            tokenType: response.data.token_type,
        };
    } catch (error) {
        console.error('Token exchange failed:', error);
        throw new AuthenticationError('Failed to exchange authorization code');
    }
}

/**
 * Refreshes expired access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
        const response = await axios.post(
            config.azure.tokenEndpoint,
            new URLSearchParams({
                client_id: config.azure.clientId,
                client_secret: config.azure.clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
                scope: config.graph.scopeString,
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        return {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token || refreshToken,
            expiresIn: response.data.expires_in,
            tokenType: response.data.token_type,
        };
    } catch (error) {
        console.error('Token refresh failed:', error);
        throw new AuthenticationError('Failed to refresh access token');
    }
}

// =============================================================================
// User Info from Graph API
// =============================================================================

/**
 * Fetches user information from Microsoft Graph API
 */
export async function getGraphUserInfo(accessToken: string): Promise<GraphUser> {
    try {
        const response = await axios.get(`${config.graph.baseUrl}/me`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch user info:', error);
        throw new GraphApiError('Failed to fetch user information from Microsoft Graph');
    }
}

// =============================================================================
// User Management
// =============================================================================

/**
 * Creates or updates user after successful OAuth authentication
 */
export async function createOrUpdateUser(
    graphUser: GraphUser,
    tokens: AuthTokens
): Promise<{ user: AuthenticatedUser; token: string }> {
    const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // Encrypt tokens before storage
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);

    // Upsert user
    const user = await prisma.user.upsert({
        where: { email: graphUser.mail || graphUser.userPrincipalName },
        update: {
            firstName: graphUser.givenName,
            lastName: graphUser.surname,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiresAt,
            isActive: true,
        },
        create: {
            email: graphUser.mail || graphUser.userPrincipalName,
            firstName: graphUser.givenName,
            lastName: graphUser.surname,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiresAt,
            role: 'accountant', // Default role
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
        },
    });

    const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
    };

    // Generate JWT for our API
    const jwtToken = generateToken(authenticatedUser);

    return { user: authenticatedUser, token: jwtToken };
}

// =============================================================================
// Token Management
// =============================================================================

/**
 * Gets valid access token for a user, refreshing if necessary
 */
export async function getValidAccessToken(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: true,
        },
    });

    if (!user || !user.accessToken || !user.refreshToken) {
        throw new AuthenticationError('User tokens not found');
    }

    // Check if token is expired or about to expire (5 minute buffer)
    const isExpired =
        !user.tokenExpiresAt || user.tokenExpiresAt.getTime() <= Date.now() + 5 * 60 * 1000;

    if (!isExpired) {
        return decryptToken(user.accessToken);
    }

    // Refresh the token
    const decryptedRefreshToken = decryptToken(user.refreshToken);
    const newTokens = await refreshAccessToken(decryptedRefreshToken);

    // Update stored tokens
    const encryptedAccessToken = encryptToken(newTokens.accessToken);
    const encryptedRefreshToken = encryptToken(newTokens.refreshToken);
    const tokenExpiresAt = new Date(Date.now() + newTokens.expiresIn * 1000);

    await prisma.user.update({
        where: { id: userId },
        data: {
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiresAt,
        },
    });

    return newTokens.accessToken;
}

// =============================================================================
// Logout
// =============================================================================

/**
 * Logs out user by clearing their tokens
 */
export async function logout(userId: string): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: {
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
        },
    });
}

// =============================================================================
// User Profile
// =============================================================================

/**
 * Gets user profile by ID
 */
export async function getUserProfile(userId: string): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastEmailSyncTime: true,
            graphSubscriptionId: true,
            graphSubscriptionExpiresAt: true,
        },
    });

    if (!user || !user.isActive) {
        return null;
    }

    return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
    };
}

// =============================================================================
// Service Export
// =============================================================================

export const authService = {
    getAuthorizationUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    getGraphUserInfo,
    createOrUpdateUser,
    getValidAccessToken,
    logout,
    getUserProfile,
};

export default authService;
