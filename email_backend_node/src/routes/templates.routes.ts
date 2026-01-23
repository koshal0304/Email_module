// =============================================================================
// Template and Signature Routes
// =============================================================================
// Email templates and signatures management
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';
import {
    asyncHandler,
    authenticate,
    validateBody,
    validateQuery,
    validateParams,
} from '../middleware';
import { prisma } from '../config/database';
import {
    createTemplateSchema,
    updateTemplateSchema,
    createSignatureSchema,
    updateSignatureSchema,
    uuidSchema,
    paginationSchema,
    renderTemplateSchema,
} from '../utils/validators';
import { NotFoundError } from '../utils/exceptions';

const router = Router();

// All routes require authentication
router.use(authenticate);

// =============================================================================
// Schemas
// =============================================================================

const idParams = z.object({
    id: uuidSchema,
});

// =============================================================================
// TEMPLATE ROUTES
// =============================================================================

/**
 * GET /templates
 * Lists all templates
 */
router.get(
    '/',
    validateQuery(paginationSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { page = 1, limit = 20 } = req.query as Record<string, unknown>;

        const skip = (Number(page) - 1) * Number(limit);

        const [templates, total] = await Promise.all([
            prisma.emailTemplate.findMany({
                where: {
                    OR: [
                        { createdBy: userId },
                        { createdBy: null }, // Global templates
                    ],
                    isActive: true,
                },
                skip,
                take: Number(limit),
                orderBy: { name: 'asc' },
                include: {
                    creator: {
                        select: { email: true, firstName: true, lastName: true },
                    },
                },
            }),
            prisma.emailTemplate.count({
                where: {
                    OR: [{ createdBy: userId }, { createdBy: null }],
                    isActive: true,
                },
            }),
        ]);

        res.json({
            success: true,
            data: templates,
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
 * GET /templates/:id
 * Gets a single template
 */
router.get(
    '/:id',
    validateParams(idParams),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const template = await prisma.emailTemplate.findUnique({
            where: { id },
            include: {
                creator: {
                    select: { email: true, firstName: true, lastName: true },
                },
            },
        });

        if (!template) {
            throw new NotFoundError('Template', id);
        }

        res.json({
            success: true,
            data: template,
        });
    })
);

/**
 * POST /templates
 * Creates a new template
 */
router.post(
    '/',
    validateBody(createTemplateSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        const template = await prisma.emailTemplate.create({
            data: {
                ...req.body,
                createdBy: userId,
                variables: req.body.variables || [],
            },
        });

        res.status(201).json({
            success: true,
            data: template,
        });
    })
);

/**
 * PATCH /templates/:id
 * Updates a template
 */
router.patch(
    '/:id',
    validateParams(idParams),
    validateBody(updateTemplateSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { id } = req.params;

        // Verify ownership
        const existing = await prisma.emailTemplate.findFirst({
            where: { id, createdBy: userId },
        });

        if (!existing) {
            throw new NotFoundError('Template', id);
        }

        const template = await prisma.emailTemplate.update({
            where: { id },
            data: req.body,
        });

        res.json({
            success: true,
            data: template,
        });
    })
);

/**
 * DELETE /templates/:id
 * Deletes a template
 */
router.delete(
    '/:id',
    validateParams(idParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { id } = req.params;

        // Verify ownership
        const existing = await prisma.emailTemplate.findFirst({
            where: { id, createdBy: userId },
        });

        if (!existing) {
            throw new NotFoundError('Template', id);
        }

        // Soft delete
        await prisma.emailTemplate.update({
            where: { id },
            data: { isActive: false },
        });

        res.json({
            success: true,
            message: 'Template deleted successfully',
        });
    })
);

/**
 * POST /templates/:id/render
 * Renders a template with context variables
 */
router.post(
    '/:id/render',
    validateParams(idParams),
    validateBody(renderTemplateSchema),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { context } = req.body;

        const template = await prisma.emailTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            throw new NotFoundError('Template', id);
        }

        // Simple variable substitution
        const render = (text: string | null): string | null => {
            if (!text) return null;

            let rendered = text;
            for (const [key, value] of Object.entries(context)) {
                const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                rendered = rendered.replace(regex, String(value));
            }
            return rendered;
        };

        const rendered = {
            subject: render(template.subjectTemplate) || template.subjectTemplate,
            body: render(template.bodyTemplate),
            bodyHtml: render(template.bodyHtmlTemplate),
        };

        // Increment usage count
        await prisma.emailTemplate.update({
            where: { id },
            data: { usageCount: { increment: 1 } },
        });

        res.json({
            success: true,
            data: rendered,
        });
    })
);

// =============================================================================
// SIGNATURE ROUTES
// =============================================================================

/**
 * GET /templates/signatures
 * Lists user's signatures
 */
router.get(
    '/signatures/list',
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        const signatures = await prisma.emailSignature.findMany({
            where: { userId, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });

        res.json({
            success: true,
            data: signatures,
        });
    })
);

/**
 * GET /templates/signatures/:id
 * Gets a single signature
 */
router.get(
    '/signatures/:id',
    validateParams(idParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { id } = req.params;

        const signature = await prisma.emailSignature.findFirst({
            where: { id, userId },
        });

        if (!signature) {
            throw new NotFoundError('Signature', id);
        }

        res.json({
            success: true,
            data: signature,
        });
    })
);

/**
 * POST /templates/signatures
 * Creates a new signature
 */
router.post(
    '/signatures',
    validateBody(createSignatureSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;

        // If this is set as default, unset other defaults
        if (req.body.isDefault) {
            await prisma.emailSignature.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false },
            });
        }

        const signature = await prisma.emailSignature.create({
            data: {
                ...req.body,
                userId,
            },
        });

        res.status(201).json({
            success: true,
            data: signature,
        });
    })
);

/**
 * PATCH /templates/signatures/:id
 * Updates a signature
 */
router.patch(
    '/signatures/:id',
    validateParams(idParams),
    validateBody(updateSignatureSchema),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { id } = req.params;

        const existing = await prisma.emailSignature.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            throw new NotFoundError('Signature', id);
        }

        // If this is set as default, unset other defaults
        if (req.body.isDefault) {
            await prisma.emailSignature.updateMany({
                where: { userId, isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        const signature = await prisma.emailSignature.update({
            where: { id },
            data: req.body,
        });

        res.json({
            success: true,
            data: signature,
        });
    })
);

/**
 * DELETE /templates/signatures/:id
 * Deletes a signature
 */
router.delete(
    '/signatures/:id',
    validateParams(idParams),
    asyncHandler(async (req, res) => {
        const userId = req.user!.id;
        const { id } = req.params;

        const existing = await prisma.emailSignature.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            throw new NotFoundError('Signature', id);
        }

        // Soft delete
        await prisma.emailSignature.update({
            where: { id },
            data: { isActive: false },
        });

        res.json({
            success: true,
            message: 'Signature deleted successfully',
        });
    })
);

export default router;
