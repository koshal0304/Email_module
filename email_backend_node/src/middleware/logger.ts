// =============================================================================
// Request Logger Middleware
// =============================================================================
// HTTP request/response logging with timing information
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// =============================================================================
// Colors for Console Output
// =============================================================================

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

// =============================================================================
// Status Color Helper
// =============================================================================

function getStatusColor(status: number): string {
    if (status >= 500) return colors.red;
    if (status >= 400) return colors.yellow;
    if (status >= 300) return colors.cyan;
    if (status >= 200) return colors.green;
    return colors.reset;
}

// =============================================================================
// Method Color Helper
// =============================================================================

function getMethodColor(method: string): string {
    switch (method) {
        case 'GET':
            return colors.green;
        case 'POST':
            return colors.blue;
        case 'PUT':
        case 'PATCH':
            return colors.yellow;
        case 'DELETE':
            return colors.red;
        default:
            return colors.reset;
    }
}

// =============================================================================
// Request Logger
// =============================================================================

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    // Skip logging for health checks
    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }

    const startTime = Date.now();
    req.startTime = startTime;

    // Log request
    if (config.isDevelopment) {
        console.log(
            `${colors.dim}→${colors.reset} ` +
                `${getMethodColor(req.method)}${req.method}${colors.reset} ` +
                `${req.path}`
        );
    }

    // Override res.end to log response
    const originalEnd = res.end.bind(res);
    res.end = function (
        this: Response,
        chunk?: unknown,
        encoding?: BufferEncoding | (() => void),
        callback?: () => void
    ): Response {
        const duration = Date.now() - startTime;
        const statusColor = getStatusColor(res.statusCode);

        if (config.isDevelopment) {
            console.log(
                `${colors.dim}←${colors.reset} ` +
                    `${getMethodColor(req.method)}${req.method}${colors.reset} ` +
                    `${req.path} ` +
                    `${statusColor}${res.statusCode}${colors.reset} ` +
                    `${colors.dim}${duration}ms${colors.reset}`
            );
        }

        // Handle the different overloads
        if (typeof encoding === 'function') {
            return originalEnd(chunk, encoding);
        }
        return originalEnd(chunk, encoding as BufferEncoding, callback);
    };

    next();
}

// =============================================================================
// Request ID Middleware
// =============================================================================

let requestCounter = 0;

export function requestId(_req: Request, res: Response, next: NextFunction): void {
    const id = `req-${Date.now()}-${++requestCounter}`;
    res.setHeader('X-Request-ID', id);
    next();
}

export default requestLogger;
