// =============================================================================
// Middleware Index
// =============================================================================
// Central export for all middleware
// =============================================================================

export {
    authenticate,
    optionalAuthenticate,
    requireRole,
    requireAdmin,
    requireAccountant,
    requireClientManager,
    generateToken,
    getCurrentUser,
} from './auth';
export {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    validate,
    validateBody,
    validateQuery,
    validateParams,
} from './errorHandler';
export {
    rateLimiter,
    authRateLimiter,
    emailSendRateLimiter,
    searchRateLimiter,
} from './rateLimiter';
export { requestLogger, requestId } from './logger';
