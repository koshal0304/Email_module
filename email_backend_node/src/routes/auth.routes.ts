// =============================================================================
// Authentication Routes
// =============================================================================
// OAuth 2.0 authentication endpoints
// =============================================================================

import { Router } from 'express';
import { asyncHandler, authenticate, validateQuery } from '../middleware';
import { authService } from '../services';
import { z } from 'zod';

const router = Router();

// =============================================================================
// Schemas
// =============================================================================

const callbackSchema = z.object({
    code: z.string().min(1, 'Authorization code is required'),
    state: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /auth/login
 * Initiates OAuth 2.0 login flow
 */
router.get(
    '/login',
    asyncHandler(async (req, res) => {
        const state = req.query.state as string | undefined;
        const authUrl = authService.getAuthorizationUrl(state);

        return res.json({
            success: true,
            data: {
                authUrl,
                message: 'Redirect user to this URL to initiate login',
            },
        });
    })
);

/**
 * GET /auth/callback
 * OAuth 2.0 callback endpoint
 */
router.get(
    '/callback',
    validateQuery(callbackSchema),
    asyncHandler(async (req, res) => {
        const { code, error, error_description } = req.query as z.infer<typeof callbackSchema>;

        // Handle OAuth errors
        if (error) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'OAUTH_ERROR',
                    message: error_description || error,
                },
            });
        }

        // Exchange code for tokens
        const tokens = await authService.exchangeCodeForTokens(code);

        // Get user info from Graph
        const graphUser = await authService.getGraphUserInfo(tokens.accessToken);

        // Create or update user in database
        const { token } = await authService.createOrUpdateUser(graphUser, tokens);

        // Determine redirect URL from state or default to Streamlit UI
        const state = req.query.state as string | undefined;
        let redirectUrl = 'http://localhost:8502'; // Default to Streamlit UI port

        if (state && (state.startsWith('http://') || state.startsWith('https://'))) {
            redirectUrl = state;
        }

        // Construct redirect URL with token
        const finalUrl = new URL(redirectUrl);
        finalUrl.searchParams.set('token', token);

        return res.redirect(finalUrl.toString());
    })
);

/**
 * POST /auth/refresh
 * Refreshes the current user's tokens
 */
router.post(
    '/refresh',
    authenticate,
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        // Get new access token (this will refresh if needed)
        await authService.getValidAccessToken(userId);

        return res.json({
            success: true,
            message: 'Token refreshed successfully',
        });
    })
);

/**
 * POST /auth/logout
 * Logs out the current user
 */
router.post(
    '/logout',
    authenticate,
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        await authService.logout(userId);

        return res.json({
            success: true,
            message: 'Logged out successfully',
        });
    })
);

/**
 * GET /auth/me
 * Gets the current user's profile
 */
router.get(
    '/me',
    authenticate,
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        const profile = await authService.getUserProfile(userId);

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User profile not found',
                },
            });
        }

        return res.json({
            success: true,
            data: profile,
        });
    })
);

/**
 * GET /auth/status
 * Checks authentication status
 */
router.get(
    '/status',
    asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            return res.json({
                success: true,
                data: {
                    authenticated: false,
                },
            });
        }

        try {
            // Try to authenticate
            const token = authHeader.substring(7);
            const jwt = require('jsonwebtoken');
            const { config } = require('../config');

            const payload = jwt.verify(token, config.jwt.secret);

            return res.json({
                success: true,
                data: {
                    authenticated: true,
                    userId: payload.userId,
                    email: payload.email,
                },
            });
        } catch {
            return res.json({
                success: true,
                data: {
                    authenticated: false,
                },
            });
        }
    })
);

export default router;
