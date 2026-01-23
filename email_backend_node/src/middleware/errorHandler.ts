// =============================================================================
// Error Handler Middleware
// =============================================================================
// Centralized error handling with proper HTTP responses
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from '../config';
import { isAppError } from '../utils/exceptions';

// =============================================================================
// Error Response Interface
// =============================================================================

interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
        stack?: string;
    };
}

// =============================================================================
// Error Handler
// =============================================================================

export function errorHandler(
    error: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    // Log the error
    console.error('Error:', error);

    // Default error response
    let statusCode = 500;
    let errorResponse: ErrorResponse = {
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        },
    };

    // Handle known application errors
    if (isAppError(error)) {
        statusCode = error.statusCode;
        errorResponse = {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        };
    }

    // Handle Zod validation errors
    else if (error instanceof ZodError) {
        statusCode = 400;
        const formattedErrors = error.errors.reduce(
            (acc, err) => {
                const path = err.path.join('.');
                acc[path] = err.message;
                return acc;
            },
            {} as Record<string, string>
        );

        errorResponse = {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: { fields: formattedErrors },
            },
        };
    }

    // Handle Prisma errors
    else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const { code, meta } = error;

        switch (code) {
            case 'P2002': // Unique constraint violation
                statusCode = 409;
                errorResponse = {
                    success: false,
                    error: {
                        code: 'DUPLICATE_ERROR',
                        message: `Duplicate value for: ${(meta?.target as string[])?.join(', ') || 'unknown field'}`,
                        details: { target: meta?.target },
                    },
                };
                break;

            case 'P2025': // Record not found
                statusCode = 404;
                errorResponse = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Record not found',
                        details: meta,
                    },
                };
                break;

            case 'P2003': // Foreign key constraint violation
                statusCode = 400;
                errorResponse = {
                    success: false,
                    error: {
                        code: 'FOREIGN_KEY_ERROR',
                        message: 'Referenced record does not exist',
                        details: meta,
                    },
                };
                break;

            default:
                statusCode = 500;
                errorResponse = {
                    success: false,
                    error: {
                        code: 'DATABASE_ERROR',
                        message: 'A database error occurred',
                    },
                };
        }
    }

    // Handle Prisma validation errors
    else if (error instanceof Prisma.PrismaClientValidationError) {
        statusCode = 400;
        errorResponse = {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid data provided',
            },
        };
    }

    // Handle syntax errors (malformed JSON)
    else if (error instanceof SyntaxError && 'body' in error) {
        statusCode = 400;
        errorResponse = {
            success: false,
            error: {
                code: 'INVALID_JSON',
                message: 'Invalid JSON in request body',
            },
        };
    }

    // Include stack trace in development
    if (config.isDevelopment && error.stack) {
        errorResponse.error.stack = error.stack;
    }

    res.status(statusCode).json(errorResponse);
}

// =============================================================================
// Not Found Handler
// =============================================================================

export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Cannot ${req.method} ${req.path}`,
        },
    });
}

// =============================================================================
// Async Handler Wrapper
// =============================================================================

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(handler: AsyncHandler) {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

// =============================================================================
// Validation Middleware Factory
// =============================================================================

import { ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Creates a validation middleware for the specified target
 */
export function validate<T extends ZodSchema>(schema: T, target: ValidationTarget = 'body') {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            const data = schema.parse(req[target]);
            req[target] = data;
            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Validates request body
 */
export function validateBody<T extends ZodSchema>(schema: T) {
    return validate(schema, 'body');
}

/**
 * Validates query parameters
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
    return validate(schema, 'query');
}

/**
 * Validates route parameters
 */
export function validateParams<T extends ZodSchema>(schema: T) {
    return validate(schema, 'params');
}
