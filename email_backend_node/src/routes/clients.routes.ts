// =============================================================================
// Client Routes
// =============================================================================
// Tax client management endpoints
// =============================================================================

import { Router } from 'express';
import {
    asyncHandler,
    authenticate,
    validateBody,
    validateQuery,
    validateParams,
} from '../middleware';
import { prisma } from '../config/database';
import { auditService } from '../services';
import {
    createClientSchema,
    updateClientSchema,
    uuidSchema,
    paginationSchema,
} from '../utils/validators';
import { NotFoundError, DuplicateError } from '../utils/exceptions';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const router = Router();

// All client routes require authentication
router.use(authenticate);

// =============================================================================
// Schemas
// =============================================================================

const clientIdParams = z.object({
    clientId: uuidSchema,
});

const clientFiltersSchema = z.object({
    search: z.string().optional(),
    clientType: z.enum(['corporate', 'non_corporate']).optional(),
    isActive: z.coerce.boolean().optional(),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /clients
 * Lists all clients with filtering and pagination
 */
router.get(
    '/',
    validateQuery(clientFiltersSchema.merge(paginationSchema)),
    asyncHandler(async (req, res) => {
        const {
            page = 1,
            limit = 20,
            sortBy = 'name',
            sortOrder = 'asc',
            search,
            clientType,
            isActive,
        } = req.query as Record<string, unknown>;

        const skip = (Number(page) - 1) * Number(limit);

        // Build where clause
        const where: Prisma.ClientWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } },
                { pan: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        if (clientType) {
            where.clientType = clientType as string;
        }

        if (isActive !== undefined) {
            where.isActive = isActive === 'true' || isActive === true;
        }

        const [clients, total] = await Promise.all([
            prisma.client.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { [sortBy as string]: sortOrder },
                include: {
                    _count: {
                        select: { emails: true, emailThreads: true },
                    },
                },
            }),
            prisma.client.count({ where }),
        ]);

        const totalPages = Math.ceil(total / Number(limit));

        res.json({
            success: true,
            data: clients,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages,
                hasNext: Number(page) * Number(limit) < total,
                hasPrev: Number(page) > 1,
            },
        });
    })
);

/**
 * GET /clients/:clientId
 * Gets a single client by ID
 */
router.get(
    '/:clientId',
    validateParams(clientIdParams),
    asyncHandler(async (req, res) => {
        const { clientId } = req.params;

        const client = await prisma.client.findUnique({
            where: { id: clientId },
            include: {
                footers: true,
                _count: {
                    select: { emails: true, emailThreads: true },
                },
            },
        });

        if (!client) {
            throw new NotFoundError('Client', clientId);
        }

        res.json({
            success: true,
            data: client,
        });
    })
);

/**
 * POST /clients
 * Creates a new client
 */
router.post(
    '/',
    validateBody(createClientSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        // Check for duplicate PAN
        if (req.body.pan) {
            const existingPan = await prisma.client.findUnique({
                where: { pan: req.body.pan },
            });
            if (existingPan) {
                throw new DuplicateError('PAN', req.body.pan);
            }
        }

        const client = await prisma.client.create({
            data: req.body,
        });

        await auditService.logClientAction(userId, client.id, 'client_linked', {
            ipAddress: req.ip,
            details: { action: 'created' },
        });

        res.status(201).json({
            success: true,
            data: client,
        });
    })
);

/**
 * PATCH /clients/:clientId
 * Updates a client
 */
router.patch(
    '/:clientId',
    validateParams(clientIdParams),
    validateBody(updateClientSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { clientId } = req.params;

        // Check if client exists
        const existing = await prisma.client.findUnique({
            where: { id: clientId },
        });

        if (!existing) {
            throw new NotFoundError('Client', clientId);
        }

        // Check for duplicate PAN if being updated
        if (req.body.pan && req.body.pan !== existing.pan) {
            const existingPan = await prisma.client.findUnique({
                where: { pan: req.body.pan },
            });
            if (existingPan) {
                throw new DuplicateError('PAN', req.body.pan);
            }
        }

        const client = await prisma.client.update({
            where: { id: clientId },
            data: req.body,
        });

        await auditService.logClientAction(userId, clientId, 'client_linked', {
            ipAddress: req.ip,
            details: { action: 'updated', changes: Object.keys(req.body) },
        });

        res.json({
            success: true,
            data: client,
        });
    })
);

/**
 * DELETE /clients/:clientId
 * Deletes a client
 */
router.delete(
    '/:clientId',
    validateParams(clientIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { clientId } = req.params;

        const existing = await prisma.client.findUnique({
            where: { id: clientId },
        });

        if (!existing) {
            throw new NotFoundError('Client', clientId);
        }

        // Soft delete by deactivating
        await prisma.client.update({
            where: { id: clientId },
            data: { isActive: false },
        });

        await auditService.logClientAction(userId, clientId, 'deleted', {
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            message: 'Client deleted successfully',
        });
    })
);

/**
 * GET /clients/:clientId/emails
 * Gets emails associated with a client
 */
router.get(
    '/:clientId/emails',
    validateParams(clientIdParams),
    validateQuery(paginationSchema),
    asyncHandler(async (req, res) => {
        const { clientId } = req.params;
        const { page = 1, limit = 20 } = req.query as Record<string, unknown>;

        const skip = (Number(page) - 1) * Number(limit);

        const [emails, total] = await Promise.all([
            prisma.email.findMany({
                where: { clientId },
                skip,
                take: Number(limit),
                orderBy: { receivedDateTime: 'desc' },
                include: {
                    thread: { select: { id: true, subject: true, status: true } },
                },
            }),
            prisma.email.count({ where: { clientId } }),
        ]);

        res.json({
            success: true,
            data: emails,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
                hasNext: Number(page) * Number(limit) < total,
                hasPrev: Number(page) > 1,
            },
        });
    })
);

/**
 * GET /clients/:clientId/threads
 * Gets threads associated with a client
 */
router.get(
    '/:clientId/threads',
    validateParams(clientIdParams),
    validateQuery(paginationSchema),
    asyncHandler(async (req, res) => {
        const { clientId } = req.params;
        const { page = 1, limit = 20 } = req.query as Record<string, unknown>;

        const skip = (Number(page) - 1) * Number(limit);

        const [threads, total] = await Promise.all([
            prisma.emailThread.findMany({
                where: { clientId },
                skip,
                take: Number(limit),
                orderBy: { lastActivityAt: 'desc' },
                include: {
                    _count: { select: { emails: true } },
                },
            }),
            prisma.emailThread.count({ where: { clientId } }),
        ]);

        res.json({
            success: true,
            data: threads,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
                hasNext: Number(page) * Number(limit) < total,
                hasPrev: Number(page) > 1,
            },
        });
    })
);

export default router;
