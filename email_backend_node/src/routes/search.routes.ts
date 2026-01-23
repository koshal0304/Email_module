// =============================================================================
// Search Routes
// =============================================================================
// Full-text search endpoints
// =============================================================================

import { Router } from 'express';
import { asyncHandler, authenticate, validateQuery, searchRateLimiter } from '../middleware';
import { searchService } from '../services';
import { searchQuerySchema } from '../utils/validators';
import { z } from 'zod';

const router = Router();

// All search routes require authentication
router.use(authenticate);

// =============================================================================
// Schemas
// =============================================================================

const suggestionsSchema = z.object({
    prefix: z.string().min(2).max(100),
    limit: z.coerce.number().int().positive().max(20).default(10),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /search
 * Performs full-text search across emails
 */
router.get(
    '/',
    searchRateLimiter,
    validateQuery(searchQuerySchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { query, page, limit, sortBy, sortOrder, ...filters } = req.query;

        const result = await searchService.searchEmails(userId, {
            query: query as string,
            filters,
            pagination: {
                page: Number(page) || 1,
                limit: Number(limit) || 20,
                sortBy: sortBy as string,
                sortOrder: sortOrder as 'asc' | 'desc',
            },
        });

        res.json({
            success: true,
            ...result,
        });
    })
);

/**
 * GET /search/suggestions
 * Gets search suggestions based on prefix
 */
router.get(
    '/suggestions',
    validateQuery(suggestionsSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { prefix, limit } = req.query as unknown as z.infer<typeof suggestionsSchema>;

        const suggestions = await searchService.getSuggestions(userId, prefix, Number(limit));

        res.json({
            success: true,
            data: suggestions,
        });
    })
);

/**
 * GET /search/filters
 * Gets available filter options
 */
router.get(
    '/filters',
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        const filters = await searchService.getFilterOptions(userId);

        res.json({
            success: true,
            data: filters,
        });
    })
);

export default router;
