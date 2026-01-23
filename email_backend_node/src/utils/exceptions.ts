// =============================================================================
// Custom Exceptions
// =============================================================================
// Centralized error handling with typed exception classes
// =============================================================================

// =============================================================================
// Base Application Error
// =============================================================================

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly details?: Record<string, unknown>;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR',
        details?: Record<string, unknown>
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}

// =============================================================================
// Authentication Errors
// =============================================================================

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication failed', details?: Record<string, unknown>) {
        super(message, 401, 'AUTHENTICATION_ERROR', details);
    }
}

export class TokenExpiredError extends AppError {
    constructor(message: string = 'Token has expired') {
        super(message, 401, 'TOKEN_EXPIRED');
    }
}

export class InvalidTokenError extends AppError {
    constructor(message: string = 'Invalid token') {
        super(message, 401, 'INVALID_TOKEN');
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized access') {
        super(message, 403, 'UNAUTHORIZED');
    }
}

export class TokenRefreshError extends AppError {
    constructor(message: string = 'Failed to refresh access token') {
        super(message, 401, 'TOKEN_REFRESH_FAILED');
    }
}

// =============================================================================
// Resource Errors
// =============================================================================

export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
        super(message, 404, 'NOT_FOUND', { resource, id });
    }
}

export class ConflictError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 409, 'CONFLICT', details);
    }
}

export class DuplicateError extends AppError {
    constructor(field: string, value: string) {
        super(`Duplicate value for ${field}: ${value}`, 409, 'DUPLICATE', { field, value });
    }
}

// =============================================================================
// Validation Errors
// =============================================================================

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

export class InvalidInputError extends AppError {
    constructor(field: string, message: string) {
        super(`Invalid ${field}: ${message}`, 400, 'INVALID_INPUT', { field });
    }
}

// =============================================================================
// External Service Errors
// =============================================================================

export class GraphApiError extends AppError {
    public readonly graphError?: Record<string, unknown>;

    constructor(message: string, statusCode: number = 500, graphError?: Record<string, unknown>) {
        super(message, statusCode, 'GRAPH_API_ERROR', graphError);
        this.graphError = graphError;
    }
}

export class ElasticsearchError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 500, 'ELASTICSEARCH_ERROR', details);
    }
}

export class RedisError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 500, 'REDIS_ERROR', details);
    }
}

// =============================================================================
// Email Specific Errors
// =============================================================================

export class EmailSyncError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 500, 'EMAIL_SYNC_ERROR', details);
    }
}

export class EmailSendError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 500, 'EMAIL_SEND_ERROR', details);
    }
}

export class ThreadingError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 500, 'THREADING_ERROR', details);
    }
}

// =============================================================================
// Rate Limiting Errors
// =============================================================================

export class RateLimitError extends AppError {
    public readonly retryAfter?: number;

    constructor(message: string = 'Too many requests', retryAfter?: number) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
        this.retryAfter = retryAfter;
    }
}

// =============================================================================
// Webhook Errors
// =============================================================================

export class WebhookValidationError extends AppError {
    constructor(message: string = 'Webhook validation failed') {
        super(message, 400, 'WEBHOOK_VALIDATION_ERROR');
    }
}

export class WebhookProcessingError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 500, 'WEBHOOK_PROCESSING_ERROR', details);
    }
}

// =============================================================================
// Type Guard
// =============================================================================

export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

// =============================================================================
// Error Factory
// =============================================================================

export function createErrorFromStatus(statusCode: number, message: string): AppError {
    switch (statusCode) {
        case 400:
            return new ValidationError(message);
        case 401:
            return new AuthenticationError(message);
        case 403:
            return new UnauthorizedError(message);
        case 404:
            return new NotFoundError(message);
        case 409:
            return new ConflictError(message);
        case 429:
            return new RateLimitError(message);
        default:
            return new AppError(message, statusCode);
    }
}
