// =============================================================================
// Rate Limiter Middleware
// =============================================================================
// Express rate limiting with Redis backend for distributed systems
// =============================================================================

import rateLimit from 'express-rate-limit';
import { config } from '../config';

// =============================================================================
// Default Rate Limiter
// =============================================================================

export const rateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise use IP
        return req.user?.id || req.ip || 'anonymous';
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
    },
});

// =============================================================================
// Strict Rate Limiter (for auth endpoints)
// =============================================================================

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    message: {
        success: false,
        error: {
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts, please try again later',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || 'anonymous',
});

// =============================================================================
// Email Send Rate Limiter
// =============================================================================

export const emailSendRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 emails per minute
    message: {
        success: false,
        error: {
            code: 'EMAIL_RATE_LIMIT_EXCEEDED',
            message: 'Too many emails sent, please try again later',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
});

// =============================================================================
// Search Rate Limiter
// =============================================================================

export const searchRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 searches per minute
    message: {
        success: false,
        error: {
            code: 'SEARCH_RATE_LIMIT_EXCEEDED',
            message: 'Too many search requests, please try again later',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
});

export default rateLimiter;
