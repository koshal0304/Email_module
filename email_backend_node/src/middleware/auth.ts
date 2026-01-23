// =============================================================================
// Authentication Middleware
// =============================================================================
// JWT-based authentication with role-based access control
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/database';
import {
    AuthenticationError,
    InvalidTokenError,
    TokenExpiredError,
    UnauthorizedError,
} from '../utils/exceptions';
import { AuthenticatedUser, JwtPayload, UserRole } from '../types';

// =============================================================================
// Token Extraction
// =============================================================================

function extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Check query parameter (for webhook validation)
    if (req.query.token && typeof req.query.token === 'string') {
        return req.query.token;
    }

    return null;
}

// =============================================================================
// JWT Verification
// =============================================================================

function verifyToken(token: string): JwtPayload {
    try {
        const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new TokenExpiredError('Access token has expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new InvalidTokenError('Invalid access token');
        }
        throw new AuthenticationError('Token verification failed');
    }
}

// =============================================================================
// Get Current User Middleware
// =============================================================================

/**
 * Middleware that authenticates the request and attaches user to req.user
 */
export async function authenticate(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const token = extractToken(req);

        if (!token) {
            throw new AuthenticationError('No authentication token provided');
        }

        const payload = verifyToken(token);

        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
            },
        });

        if (!user) {
            throw new AuthenticationError('User not found');
        }

        if (!user.isActive) {
            throw new AuthenticationError('User account is deactivated');
        }

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
        };

        next();
    } catch (error) {
        next(error);
    }
}

// =============================================================================
// Optional Authentication
// =============================================================================

/**
 * Middleware that optionally authenticates if token is present
 */
export async function optionalAuthenticate(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const token = extractToken(req);

        if (token) {
            const payload = verifyToken(token);

            const user = await prisma.user.findUnique({
                where: { id: payload.userId },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                },
            });

            if (user && user.isActive) {
                req.user = {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                };
            }
        }

        next();
    } catch {
        // Silently continue without authentication
        next();
    }
}

// =============================================================================
// Role-Based Access Control
// =============================================================================

/**
 * Middleware factory that requires specific roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new AuthenticationError('Authentication required'));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(
                new UnauthorizedError(`Access denied. Required roles: ${allowedRoles.join(', ')}`)
            );
        }

        next();
    };
}

/**
 * Middleware that requires admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware that requires accountant or higher role
 */
export const requireAccountant = requireRole('admin', 'accountant');

/**
 * Middleware that requires client_manager or higher role
 */
export const requireClientManager = requireRole('admin', 'accountant', 'client_manager');

// =============================================================================
// Token Generation
// =============================================================================

/**
 * Generates a JWT token for the user
 */
export function generateToken(user: AuthenticatedUser): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        role: user.role,
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
    });
}

/**
 * Decodes a token without verification (for inspection)
 */
export function decodeToken(token: string): JwtPayload | null {
    try {
        return jwt.decode(token) as JwtPayload | null;
    } catch {
        return null;
    }
}

// =============================================================================
// Get Current User Helper
// =============================================================================

/**
 * Gets the current user from the request (must be after authenticate middleware)
 */
export function getCurrentUser(req: Request): AuthenticatedUser {
    if (!req.user) {
        throw new AuthenticationError('User not authenticated');
    }
    return req.user;
}
