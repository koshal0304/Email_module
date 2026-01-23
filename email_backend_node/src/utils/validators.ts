// =============================================================================
// Validation Utilities
// =============================================================================
// Zod schemas and validation functions for input sanitization
// =============================================================================

import { z } from 'zod';
import { EmailType, ThreadStatus } from '@prisma/client';

// =============================================================================
// Common Schemas
// =============================================================================

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// =============================================================================
// Email Validation
// =============================================================================

export const emailAddressSchema = z
    .string()
    .email('Invalid email address format')
    .max(254, 'Email address too long')
    .transform((email) => email.toLowerCase().trim());

export const emailRecipientSchema = z.object({
    name: z.string().max(200).optional(),
    address: emailAddressSchema,
});

export const emailRecipientsSchema = z.array(emailRecipientSchema).min(1);

// =============================================================================
// Indian Tax Identifier Validation
// =============================================================================

/**
 * PAN (Permanent Account Number) - 10 characters
 * Format: ABCDE1234F
 */
export const panSchema = z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format. Expected: ABCDE1234F')
    .transform((pan) => pan.toUpperCase());

/**
 * GSTIN (Goods and Services Tax Identification Number) - 15 characters
 * Format: 22AAAAA0000A1Z5
 */
export const gstinSchema = z
    .string()
    .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
        'Invalid GSTIN format. Expected: 22AAAAA0000A1Z5'
    )
    .transform((gstin) => gstin.toUpperCase());

/**
 * TAN (Tax Deduction and Collection Account Number) - 10 characters
 * Format: ABCD12345E
 */
export const tanSchema = z
    .string()
    .regex(/^[A-Z]{4}[0-9]{5}[A-Z]$/, 'Invalid TAN format. Expected: ABCD12345E')
    .transform((tan) => tan.toUpperCase());

// =============================================================================
// Phone Number Validation
// =============================================================================

export const phoneSchema = z
    .string()
    .regex(/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/, 'Invalid Indian phone number')
    .transform((phone) => {
        // Normalize to +91XXXXXXXXXX format
        const digits = phone.replace(/\D/g, '');
        const last10 = digits.slice(-10);
        return `+91${last10}`;
    });

// =============================================================================
// Text Sanitization
// =============================================================================

export const subjectSchema = z
    .string()
    .min(1, 'Subject is required')
    .max(500, 'Subject too long')
    .transform((subject) => subject.trim());

export const bodySchema = z
    .string()
    .max(100000, 'Body too long')
    .optional()
    .transform((body) => body?.trim());

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(html: string): string {
    // Basic HTML sanitization - in production, use a library like DOMPurify
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
}

// =============================================================================
// Request Schemas
// =============================================================================

export const sendEmailSchema = z.object({
    to: emailRecipientsSchema,
    cc: z.array(emailRecipientSchema).optional(),
    bcc: z.array(emailRecipientSchema).optional(),
    subject: subjectSchema,
    body: z.string().optional().default(''),
    bodyHtml: z.string().optional(),
    threadId: uuidSchema.optional(),
    clientId: uuidSchema.optional(),
    replyToMessageId: z.string().optional(),
    importance: z.enum(['low', 'normal', 'high']).default('normal'),
    attachments: z
        .array(
            z.object({
                name: z.string().min(1),
                contentType: z.string().min(1),
                contentBytes: z.string().min(1),
            })
        )
        .optional(),
});

export const createClientSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    email: emailAddressSchema.optional(),
    phone: phoneSchema.optional(),
    address: z.string().max(500).optional(),
    clientType: z.enum(['corporate', 'non_corporate']).optional(),
    taxYear: z.string().max(20).optional(),
    pan: panSchema.optional(),
    gstin: gstinSchema.optional(),
    tan: tanSchema.optional(),
    contactPersonName: z.string().max(200).optional(),
    contactPersonEmail: emailAddressSchema.optional(),
    contactPersonPhone: phoneSchema.optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const createSignatureSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    signatureHtml: z.string().optional(),
    signatureText: z.string().optional(),
    isDefault: z.boolean().default(false),
});

export const updateSignatureSchema = createSignatureSchema.partial();

export const createTemplateSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().max(1000).optional(),
    emailType: z.nativeEnum(EmailType).optional(),
    subjectTemplate: z.string().min(1, 'Subject template is required').max(500),
    bodyTemplate: z.string().optional(),
    bodyHtmlTemplate: z.string().optional(),
    variables: z.array(z.string()).default([]),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const renderTemplateSchema = z.object({
    context: z.record(z.union([z.string(), z.number(), z.boolean()])),
});

// =============================================================================
// Filter Schemas
// =============================================================================

export const emailFiltersSchema = z.object({
    emailType: z.nativeEnum(EmailType).optional(),
    clientId: uuidSchema.optional(),
    isRead: z.coerce.boolean().optional(),
    isFlagged: z.coerce.boolean().optional(),
    fromAddress: emailAddressSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    folderId: z.string().optional(),
    search: z.string().max(200).optional(),
});

export const threadFiltersSchema = z.object({
    status: z.nativeEnum(ThreadStatus).optional(),
    emailType: z.nativeEnum(EmailType).optional(),
    clientId: uuidSchema.optional(),
    isArchived: z.coerce.boolean().optional(),
    isFlagged: z.coerce.boolean().optional(),
    search: z.string().max(200).optional(),
});

export const searchQuerySchema = z.object({
    query: z.string().min(1, 'Search query is required').max(500),
    ...emailFiltersSchema.shape,
    ...paginationSchema.shape,
});

// =============================================================================
// Type Exports
// =============================================================================

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateSignatureInput = z.infer<typeof createSignatureSchema>;
export type UpdateSignatureInput = z.infer<typeof updateSignatureSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type RenderTemplateInput = z.infer<typeof renderTemplateSchema>;
export type EmailFiltersInput = z.infer<typeof emailFiltersSchema>;
export type ThreadFiltersInput = z.infer<typeof threadFiltersSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
