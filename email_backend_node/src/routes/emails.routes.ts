// =============================================================================
// Email Routes
// =============================================================================
// Email CRUD and sync endpoints
// =============================================================================

import { Router } from 'express';
import {
    asyncHandler,
    authenticate,
    validateBody,
    validateQuery,
    validateParams,
    emailSendRateLimiter,
} from '../middleware';
import { emailService, syncService, auditService, classificationService } from '../services';
import {
    sendEmailSchema,
    emailFiltersSchema,
    paginationSchema,
    uuidSchema,
} from '../utils/validators';
import { z } from 'zod';

const router = Router();

// All email routes require authentication
router.use(authenticate);

// =============================================================================
// Schemas
// =============================================================================

const emailIdParams = z.object({
    emailId: uuidSchema,
});

const updateEmailSchema = z.object({
    isRead: z.boolean().optional(),
    isFlagged: z.boolean().optional(),
    emailType: z.string().optional(),
    clientId: z.string().uuid().nullable().optional(),
});

const replySchema = z.object({
    body: z.string().min(1),
    replyAll: z.boolean().default(false),
});

const forwardSchema = z.object({
    to: z
        .array(
            z.object({
                name: z.string().optional(),
                address: z.string().email(),
            })
        )
        .min(1),
    comment: z.string().optional(),
});

const syncSchema = z.object({
    folderId: z.string().optional(),
    fullSync: z.coerce.boolean().default(false),
    maxEmails: z.number().optional(),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /emails
 * Lists emails with filtering and pagination
 */
router.get(
    '/',
    validateQuery(emailFiltersSchema.merge(paginationSchema)),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { page, limit, sortBy, sortOrder, ...filters } = req.query;

        const result = await emailService.listEmails(userId, filters, {
            page: Number(page),
            limit: Number(limit),
            sortBy,
            sortOrder,
        } as {
            page?: number;
            limit?: number;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        });

        res.json({
            success: true,
            ...result,
        });
    })
);

/**
 * GET /emails/types
 * Gets all available email types
 */
router.get(
    '/types',
    asyncHandler(async (_req, res) => {
        const types = classificationService.getAllEmailTypes();

        res.json({
            success: true,
            data: types,
        });
    })
);

/**
 * GET /emails/:emailId
 * Gets a single email by ID
 */
router.get(
    '/:emailId',
    validateParams(emailIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { emailId } = req.params;

        const email = await emailService.getEmail(emailId, userId);

        // Log view action
        await auditService.logEmailAction(userId, emailId, 'viewed', {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.json({
            success: true,
            data: email,
        });
    })
);

/**
 * POST /emails
 * Sends a new email
 */
router.post(
    '/',
    emailSendRateLimiter,
    validateBody(sendEmailSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        const email = await emailService.sendEmail(userId, req.body);

        // Log send action
        await auditService.logEmailAction(userId, email.id, 'sent', {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            details: {
                to: req.body.to,
                subject: req.body.subject,
            },
        });

        res.status(201).json({
            success: true,
            data: email,
        });
    })
);

/**
 * PATCH /emails/:emailId
 * Updates email properties
 */
router.patch(
    '/:emailId',
    validateParams(emailIdParams),
    validateBody(updateEmailSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { emailId } = req.params;

        const email = await emailService.updateEmail(emailId, userId, req.body);

        // Log appropriate action
        if (req.body.isRead !== undefined) {
            await auditService.logEmailAction(
                userId,
                emailId,
                req.body.isRead ? 'marked_read' : 'marked_unread',
                { ipAddress: req.ip }
            );
        }

        if (req.body.isFlagged !== undefined) {
            await auditService.logEmailAction(userId, emailId, 'flagged', {
                ipAddress: req.ip,
                details: { flagged: req.body.isFlagged },
            });
        }

        res.json({
            success: true,
            data: email,
        });
    })
);

/**
 * DELETE /emails/:emailId
 * Deletes an email
 */
router.delete(
    '/:emailId',
    validateParams(emailIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { emailId } = req.params;

        // Log before deletion
        await auditService.logEmailAction(userId, emailId, 'deleted', {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });

        await emailService.deleteEmail(emailId, userId);

        res.json({
            success: true,
            message: 'Email deleted successfully',
        });
    })
);

/**
 * POST /emails/:emailId/reply
 * Replies to an email
 */
router.post(
    '/:emailId/reply',
    emailSendRateLimiter,
    validateParams(emailIdParams),
    validateBody(replySchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { emailId } = req.params;
        const { body, replyAll } = req.body;

        await emailService.replyToEmail(emailId, userId, body, replyAll);

        await auditService.logEmailAction(userId, emailId, 'replied', {
            ipAddress: req.ip,
            details: { replyAll },
        });

        res.json({
            success: true,
            message: 'Reply sent successfully',
        });
    })
);

/**
 * POST /emails/:emailId/forward
 * Forwards an email
 */
router.post(
    '/:emailId/forward',
    emailSendRateLimiter,
    validateParams(emailIdParams),
    validateBody(forwardSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { emailId } = req.params;
        const { to, comment } = req.body;

        await emailService.forwardEmail(emailId, userId, to, comment);

        await auditService.logEmailAction(userId, emailId, 'forwarded', {
            ipAddress: req.ip,
            details: { to },
        });

        res.json({
            success: true,
            message: 'Email forwarded successfully',
        });
    })
);

/**
 * POST /emails/sync
 * Triggers email synchronization
 */
router.post(
    '/sync',
    validateBody(syncSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { folderId, fullSync, maxEmails } = req.body;

        const result = await syncService.triggerSync(userId, { folderId, fullSync, maxEmails });

        await auditService.logEmailAction(userId, '', 'synced', {
            ipAddress: req.ip,
            details: result as unknown as Record<string, unknown>,
        });

        res.json({
            success: true,
            data: result,
        });
    })
);

/**
 * GET /emails/sync/status
 * Gets sync status
 */
router.get(
    '/sync/status',
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        const status = await syncService.getSyncStatus(userId);

        res.json({
            success: true,
            data: status,
        });
    })
);

/**
 * GET /emails/:emailId/attachments
 * Lists attachments for an email
 */
router.get(
    '/:emailId/attachments',
    validateParams(emailIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { emailId } = req.params;

        const attachments = await emailService.getAttachments(emailId, userId);

        res.json({
            success: true,
            data: attachments,
        });
    })
);

/**
 * GET /emails/:emailId/attachments/:attachmentId
 * Downloads an attachment
 */
router.get(
    '/:emailId/attachments/:attachmentId',
    validateParams(emailIdParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { emailId, attachmentId } = req.params;

        const attachment = await emailService.getAttachmentContent(emailId, attachmentId, userId);

        res.json({
            success: true,
            data: attachment,
        });
    })
);

export default router;
