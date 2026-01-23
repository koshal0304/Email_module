// =============================================================================
// Thread Routes
// =============================================================================
// Email thread/conversation endpoints
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
import { uuidSchema, threadFiltersSchema, paginationSchema } from '../utils/validators';
import { ThreadStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { NotFoundError } from '../utils/exceptions';

const router = Router();

// All thread routes require authentication
router.use(authenticate);

// =============================================================================
// Schemas
// =============================================================================

const threadIdParams = z.object({
    threadId: uuidSchema,
});

const updateThreadSchema = z.object({
    status: z.nativeEnum(ThreadStatus).optional(),
    isFlagged: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    clientId: z.string().uuid().nullable().optional(),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /threads
 * Lists email threads with filtering and pagination
 */
router.get(
    '/',
    validateQuery(threadFiltersSchema.merge(paginationSchema)),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const {
            page = 1,
            limit = 20,
            sortBy = 'lastActivityAt',
            sortOrder = 'desc',
            status,
            emailType,
            clientId,
            isArchived,
            isFlagged,
            search,
        } = req.query as Record<string, unknown>;

        const skip = (Number(page) - 1) * Number(limit);

        // Build where clause
        const where: Prisma.EmailThreadWhereInput = {
            emails: {
                some: { userId },
            },
        };

        if (status) {
            where.status = status as ThreadStatus;
        }

        if (emailType) {
            where.emailType = emailType as Prisma.EnumEmailTypeNullableFilter;
        }

        if (clientId) {
            where.clientId = clientId as string;
        }

        if (isArchived !== undefined) {
            where.isArchived = isArchived === 'true' || isArchived === true;
        }

        if (isFlagged !== undefined) {
            where.isFlagged = isFlagged === 'true' || isFlagged === true;
        }

        if (search) {
            where.subject = { contains: search as string, mode: 'insensitive' };
        }

        // Get total count
        const total = await prisma.emailThread.count({ where });

        // Get threads with latest email info
        const threads = await prisma.emailThread.findMany({
            where,
            skip,
            take: Number(limit),
            orderBy: { [sortBy as string]: sortOrder },
            include: {
                client: {
                    select: { id: true, name: true },
                },
                emails: {
                    take: 1,
                    orderBy: { receivedDateTime: 'desc' },
                    select: {
                        id: true,
                        subject: true,
                        bodyPreview: true,
                        fromAddress: true,
                        fromName: true,
                        receivedDateTime: true,
                        isRead: true,
                    },
                },
                _count: {
                    select: { emails: true },
                },
            },
        });

        const totalPages = Math.ceil(total / Number(limit));

        res.json({
            success: true,
            data: threads,
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
 * GET /threads/:threadId
 * Gets a thread with all its emails
 */
router.get(
    '/:threadId',
    validateParams(threadIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { threadId } = req.params;

        const thread = await prisma.emailThread.findFirst({
            where: {
                id: threadId,
                emails: { some: { userId } },
            },
            include: {
                client: true,
                emails: {
                    orderBy: { receivedDateTime: 'asc' },
                    include: {
                        attachments: true,
                    },
                },
                auditLogs: {
                    take: 10,
                    orderBy: { timestamp: 'desc' },
                },
            },
        });

        if (!thread) {
            throw new NotFoundError('Thread', threadId);
        }

        res.json({
            success: true,
            data: thread,
        });
    })
);

/**
 * PATCH /threads/:threadId
 * Updates thread properties
 */
router.patch(
    '/:threadId',
    validateParams(threadIdParams),
    validateBody(updateThreadSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { threadId } = req.params;

        // Verify user has access to thread
        const existingThread = await prisma.emailThread.findFirst({
            where: {
                id: threadId,
                emails: { some: { userId } },
            },
        });

        if (!existingThread) {
            throw new NotFoundError('Thread', threadId);
        }

        const thread = await prisma.emailThread.update({
            where: { id: threadId },
            data: req.body,
        });

        // Log appropriate actions
        if (req.body.status === 'resolved') {
            await auditService.logThreadAction(userId, threadId, 'thread_resolved', {
                ipAddress: req.ip,
            });
        }

        if (req.body.isArchived) {
            await auditService.logThreadAction(userId, threadId, 'thread_archived', {
                ipAddress: req.ip,
            });
        }

        if (req.body.clientId) {
            await auditService.logThreadAction(userId, threadId, 'client_linked', {
                ipAddress: req.ip,
                details: { clientId: req.body.clientId },
            });
        }

        res.json({
            success: true,
            data: thread,
        });
    })
);

/**
 * POST /threads/:threadId/resolve
 * Marks a thread as resolved
 */
router.post(
    '/:threadId/resolve',
    validateParams(threadIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { threadId } = req.params;

        // Verify access
        const existingThread = await prisma.emailThread.findFirst({
            where: {
                id: threadId,
                emails: { some: { userId } },
            },
        });

        if (!existingThread) {
            throw new NotFoundError('Thread', threadId);
        }

        const thread = await prisma.emailThread.update({
            where: { id: threadId },
            data: { status: 'resolved' },
        });

        await auditService.logThreadAction(userId, threadId, 'thread_resolved', {
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            data: thread,
        });
    })
);

/**
 * POST /threads/:threadId/archive
 * Archives a thread
 */
router.post(
    '/:threadId/archive',
    validateParams(threadIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { threadId } = req.params;

        // Verify access
        const existingThread = await prisma.emailThread.findFirst({
            where: {
                id: threadId,
                emails: { some: { userId } },
            },
        });

        if (!existingThread) {
            throw new NotFoundError('Thread', threadId);
        }

        const thread = await prisma.emailThread.update({
            where: { id: threadId },
            data: { isArchived: true, status: 'archived' },
        });

        await auditService.logThreadAction(userId, threadId, 'thread_archived', {
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            data: thread,
        });
    })
);

/**
 * POST /threads/:threadId/unarchive
 * Unarchives a thread
 */
router.post(
    '/:threadId/unarchive',
    validateParams(threadIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { threadId } = req.params;

        // Verify access
        const existingThread = await prisma.emailThread.findFirst({
            where: {
                id: threadId,
                emails: { some: { userId } },
            },
        });

        if (!existingThread) {
            throw new NotFoundError('Thread', threadId);
        }

        const thread = await prisma.emailThread.update({
            where: { id: threadId },
            data: { isArchived: false, status: 'awaiting_reply' },
        });

        res.json({
            success: true,
            data: thread,
        });
    })
);

/**
 * GET /threads/:threadId/emails
 * Gets all emails in a thread
 */
router.get(
    '/:threadId/emails',
    validateParams(threadIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { threadId } = req.params;

        // Verify access
        const thread = await prisma.emailThread.findFirst({
            where: {
                id: threadId,
                emails: { some: { userId } },
            },
        });

        if (!thread) {
            throw new NotFoundError('Thread', threadId);
        }

        const emails = await prisma.email.findMany({
            where: { threadId },
            orderBy: { receivedDateTime: 'asc' },
            include: {
                attachments: true,
            },
        });

        res.json({
            success: true,
            data: emails,
        });
    })
);

export default router;
