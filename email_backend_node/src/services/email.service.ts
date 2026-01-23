// =============================================================================
// Email Service
// =============================================================================
// Core email operations: sync, send, retrieve, update
// =============================================================================

import { prisma } from '../config/database';
import { authService } from './auth.service';
import { createGraphService } from './graph.service';
import { classificationService } from './classification.service';
import { threadingEngine } from './threading.service';
import { NotFoundError, EmailSendError, EmailSyncError } from '../utils/exceptions';
import { Email, EmailThread, EmailType, EmailDirection, Prisma } from '@prisma/client';
import {
    SendEmailRequest,
    EmailFilters,
    PaginationParams,
    PaginatedResponse,
    GraphMessage,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Types
// =============================================================================

// Email with thread and attachments relations
type EmailWithThread = Email & {
    thread: EmailThread;
    attachments?: any[];
};

// =============================================================================
// Email Sync from Graph API
// =============================================================================

/**
 * Syncs emails from Microsoft Graph API for a user
 * When fullSync is true, fetches ALL emails using pagination (no limit)
 */
export async function syncEmails(
    userId: string,
    options: {
        folderId?: string;
        maxEmails?: number;
        fullSync?: boolean;
    } = {}
): Promise<{
    synced: number;
    created: number;
    updated: number;
    errors: number;
}> {
    const { folderId = 'inbox', maxEmails = 100, fullSync = false } = options;

    const result = { synced: 0, created: 0, updated: 0, errors: 0 };

    try {
        // Get valid access token
        const accessToken = await authService.getValidAccessToken(userId);
        const graphService = createGraphService(accessToken);

        console.log(
            `Starting ${fullSync ? 'FULL' : 'regular'} sync for user ${userId}, folder: ${folderId}`
        );

        let messages: GraphMessage[];

        if (fullSync) {
            // Fetch ALL messages using pagination
            messages = await graphService.listAllMessages({
                folderId,
                expand: ['attachments'],
            });
        } else {
            // Fetch only one page with limit
            const response = await graphService.listMessages({
                folderId,
                top: maxEmails,
                expand: ['attachments'],
            });
            messages = response.value;
        }

        console.log(`Processing ${messages.length} emails...`);

        for (const graphMessage of messages) {
            try {
                await processGraphMessage(userId, graphMessage);
                result.synced++;

                // Check if email exists
                const existing = await prisma.email.findFirst({
                    where: { graphMessageId: graphMessage.id },
                });

                if (existing) {
                    result.updated++;
                } else {
                    result.created++;
                }

                // Log progress every 100 emails
                if (result.synced % 100 === 0) {
                    console.log(
                        `Progress: ${result.synced} emails synced (${result.created} new, ${result.updated} updated)`
                    );
                }
            } catch (error) {
                console.error(`Error processing message ${graphMessage.id}:`, error);
                result.errors++;
            }
        }

        console.log(
            `Sync complete: ${result.synced} total emails (${result.created} new, ${result.updated} updated, ${result.errors} errors)`
        );

        // Update last sync time
        await prisma.user.update({
            where: { id: userId },
            data: { lastEmailSyncTime: new Date() },
        });

        return result;
    } catch (error) {
        console.error('Email sync failed:', error);
        throw new EmailSyncError('Failed to sync emails', { userId });
    }
}

/**
 * Processes a single Graph message and saves to database
 */
async function processGraphMessage(userId: string, graphMessage: GraphMessage): Promise<Email> {
    // Parse recipients from Graph format
    const toRecipients = graphMessage.toRecipients.map((r) => ({
        name: r.emailAddress.name,
        address: r.emailAddress.address,
    }));

    const ccRecipients = graphMessage.ccRecipients.map((r) => ({
        name: r.emailAddress.name,
        address: r.emailAddress.address,
    }));

    const bccRecipients =
        graphMessage.bccRecipients?.map((r) => ({
            name: r.emailAddress.name,
            address: r.emailAddress.address,
        })) || [];

    const replyTo =
        graphMessage.replyTo?.map((r) => ({
            name: r.emailAddress.name,
            address: r.emailAddress.address,
        })) || [];

    // Extract threading headers
    const headers = graphMessage.internetMessageHeaders || [];
    const getHeader = (name: string): string | null => {
        const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
        return header?.value || null;
    };

    const inReplyToId = getHeader('In-Reply-To');
    const references = getHeader('References');
    const taxEmailId = getHeader('X-Tax-Email-ID');

    // Classify the email
    const emailType = classificationService.classifyEmail(
        graphMessage.subject,
        graphMessage.body?.content
    );

    // Determine direction
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
    });

    const direction: EmailDirection =
        graphMessage.from.emailAddress.address.toLowerCase() === user?.email.toLowerCase()
            ? 'outgoing'
            : 'incoming';

    // Find or create thread
    const threadResult = await threadingEngine.findOrCreateThread({
        subject: graphMessage.subject,
        fromAddress: graphMessage.from.emailAddress.address,
        toRecipients,
        ccRecipients,
        conversationId: graphMessage.conversationId,
        taxEmailId,
        inReplyToId,
        references,
        emailType,
    });

    // Prepare email body
    const bodyContent = graphMessage.body?.content || '';
    const isHtml = graphMessage.body?.contentType === 'html';

    // Prepare email data
    const emailData: Prisma.EmailCreateInput = {
        id: uuidv4(),
        thread: { connect: { id: threadResult.threadId } },
        graphMessageId: graphMessage.id,
        subject: graphMessage.subject,
        body: isHtml ? bodyContent.replace(/<[^>]*>?/gm, ' ').substring(0, 5000) : bodyContent,
        bodyHtml: isHtml ? bodyContent : null,
        bodyPreview:
            graphMessage.bodyPreview || bodyContent.replace(/<[^>]*>?/gm, ' ').substring(0, 255),
        fromAddress: graphMessage.from.emailAddress.address,
        fromName: graphMessage.from.emailAddress.name,
        toRecipients: toRecipients as unknown as Prisma.InputJsonValue,
        ccRecipients: ccRecipients as unknown as Prisma.InputJsonValue,
        bccRecipients: bccRecipients as unknown as Prisma.InputJsonValue,
        replyTo: replyTo as unknown as Prisma.InputJsonValue,
        internetMessageId: graphMessage.internetMessageId,
        inReplyToId,
        references,
        conversationId: graphMessage.conversationId,
        conversationIndex: graphMessage.conversationIndex,
        taxEmailId,
        emailType,
        direction,
        isRead: graphMessage.isRead,
        status: direction === 'outgoing' ? 'sent' : 'received',
        receivedDateTime: graphMessage.receivedDateTime
            ? new Date(graphMessage.receivedDateTime)
            : null,
        sentDateTime: graphMessage.sentDateTime ? new Date(graphMessage.sentDateTime) : null,
        hasAttachments: graphMessage.hasAttachments,
        isFlagged: graphMessage.flag?.flagStatus === 'flagged',
        importance: graphMessage.importance,
        folderId: graphMessage.parentFolderId,
        user: { connect: { id: userId } },
    };

    // Check if email exists by Graph ID or Internet Message ID
    const existing = await prisma.email.findFirst({
        where: {
            OR: [
                { graphMessageId: graphMessage.id },
                { internetMessageId: graphMessage.internetMessageId },
            ].filter(Boolean) as Prisma.EmailWhereInput[],
        },
    });

    let email;
    if (existing) {
        // Update existing email with Graph ID if missing
        email = await prisma.email.update({
            where: { id: existing.id },
            data: {
                graphMessageId: graphMessage.id,
                conversationId: graphMessage.conversationId,
                conversationIndex: graphMessage.conversationIndex,
                folderId: graphMessage.parentFolderId,
                isRead: graphMessage.isRead,
                isFlagged: graphMessage.flag?.flagStatus === 'flagged',
                direction: direction,
                status: direction === 'outgoing' ? 'sent' : 'received',
                taxEmailId: existing.taxEmailId || taxEmailId,
            },
        });
    } else {
        // Create new email if not found
        email = await prisma.email.create({
            data: emailData,
        });
    }

    // Update thread
    await threadingEngine.updateThreadAfterEmail(threadResult.threadId, email);

    return email;
}

// =============================================================================
// Email CRUD Operations
// =============================================================================

/**
 * Lists emails with filtering and pagination
 */
export async function listEmails(
    userId: string,
    filters: EmailFilters = {},
    pagination: PaginationParams = {}
): Promise<PaginatedResponse<Email>> {
    const { page = 1, limit = 20, sortBy = 'receivedDateTime', sortOrder = 'desc' } = pagination;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.EmailWhereInput = {
        userId,
    };

    if (filters.emailType) {
        where.emailType = filters.emailType;
    }

    if (filters.clientId) {
        where.clientId = filters.clientId;
    }

    if (filters.isRead !== undefined) {
        where.isRead = filters.isRead;
    }

    if (filters.isFlagged !== undefined) {
        where.isFlagged = filters.isFlagged;
    }

    if (filters.fromAddress) {
        where.fromAddress = { contains: filters.fromAddress, mode: 'insensitive' };
    }

    if (filters.startDate) {
        where.receivedDateTime = { gte: filters.startDate };
    }

    if (filters.endDate) {
        where.receivedDateTime = {
            ...((where.receivedDateTime as object) || {}),
            lte: filters.endDate,
        };
    }

    if (filters.folderId) {
        where.folderId = filters.folderId;
    }

    if (filters.search) {
        where.OR = [
            { subject: { contains: filters.search, mode: 'insensitive' } },
            { bodyPreview: { contains: filters.search, mode: 'insensitive' } },
            { fromAddress: { contains: filters.search, mode: 'insensitive' } },
        ];
    }

    // Get total count
    const total = await prisma.email.count({ where });

    // Get emails
    const emails = await prisma.email.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
            thread: true,
            attachments: true,
        },
    });

    return {
        data: emails,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
        },
    };
}

/**
 * Gets a single email by ID
 */
export async function getEmail(emailId: string, userId: string): Promise<EmailWithThread> {
    const email = await prisma.email.findFirst({
        where: { id: emailId, userId },
        include: {
            thread: true,
            attachments: true,
            client: true,
        },
    });

    if (!email) {
        throw new NotFoundError('Email', emailId);
    }

    return email as EmailWithThread;
}

/**
 * Sends an email via Microsoft Graph API
 */
export async function sendEmail(userId: string, request: SendEmailRequest): Promise<Email> {
    try {
        const accessToken = await authService.getValidAccessToken(userId);
        const graphService = createGraphService(accessToken);

        // Generate a unique tax email ID for tracking this specific message across systems
        const taxEmailId = `tax-${uuidv4()}`;

        // Send via Graph API with the custom header
        await graphService.sendEmail({ ...request, taxEmailId });

        // Classify the email
        const emailType = classificationService.classifyEmail(request.subject, request.body);

        // Create or find thread
        let threadId = request.threadId;
        if (!threadId) {
            const threadResult = await threadingEngine.findOrCreateThread({
                subject: request.subject,
                fromAddress: (await prisma.user.findUnique({
                    where: { id: userId },
                    select: { email: true },
                }))!.email,
                toRecipients: request.to,
                ccRecipients: request.cc || [],
                emailType,
                clientId: request.clientId,
                taxEmailId, // Pass the custom ID here
            });
            threadId = threadResult.threadId;
        }

        // Create local email record
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true, lastName: true },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const email = await prisma.email.create({
            data: {
                id: uuidv4(),
                threadId: threadId,
                taxEmailId, // Save for matching later
                subject: request.subject,
                body:
                    request.body ||
                    (request.bodyHtml ? request.bodyHtml.replace(/<[^>]*>?/gm, '') : ''),
                bodyHtml: request.bodyHtml || request.body,
                bodyPreview: (request.body || request.bodyHtml || '')
                    .replace(/<[^>]*>?/gm, ' ')
                    .substring(0, 255)
                    .trim(),
                fromAddress: user.email,
                fromName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                toRecipients: request.to as unknown as Prisma.InputJsonValue,
                ccRecipients: (request.cc || []) as unknown as Prisma.InputJsonValue,
                bccRecipients: (request.bcc || []) as unknown as Prisma.InputJsonValue,
                emailType,
                clientId: request.clientId,
                direction: 'outgoing',
                status: 'sent',
                sentDateTime: new Date(),
                importance: request.importance || 'normal',
                userId,
                attachments: request.attachments
                    ? {
                          create: request.attachments.map((a) => ({
                              id: uuidv4(),
                              fileName: a.name,
                              contentType: a.contentType,
                              fileSize: Buffer.from(a.contentBytes, 'base64').length,
                              isInline: false,
                          })),
                      }
                    : undefined,
            },
        });

        // Update thread status and metadata
        await threadingEngine.updateThreadAfterEmail(threadId, email);

        return email;
    } catch (error) {
        console.error('Failed to send email:', error);
        throw new EmailSendError('Failed to send email');
    }
}

/**
 * Updates email properties
 */
export async function updateEmail(
    emailId: string,
    userId: string,
    updates: {
        isRead?: boolean;
        isFlagged?: boolean;
        emailType?: EmailType;
        clientId?: string | null;
    }
): Promise<Email> {
    const email = await getEmail(emailId, userId);

    // Sync with Graph API if needed
    if (email.graphMessageId && (updates.isRead !== undefined || updates.isFlagged !== undefined)) {
        try {
            const accessToken = await authService.getValidAccessToken(userId);
            const graphService = createGraphService(accessToken);

            const graphUpdates: Record<string, unknown> = {};
            if (updates.isRead !== undefined) {
                graphUpdates.isRead = updates.isRead;
            }
            if (updates.isFlagged !== undefined) {
                graphUpdates.flag = {
                    flagStatus: updates.isFlagged ? 'flagged' : 'notFlagged',
                };
            }

            if (Object.keys(graphUpdates).length > 0) {
                await graphService.updateMessage(email.graphMessageId, graphUpdates);
            }
        } catch (error) {
            console.error('Failed to sync update with Graph API:', error);
            // Continue with local update even if Graph sync fails
        }
    }

    // Update local record
    return prisma.email.update({
        where: { id: emailId },
        data: updates,
    });
}

/**
 * Deletes an email
 */
export async function deleteEmail(emailId: string, userId: string): Promise<void> {
    const email = await getEmail(emailId, userId);

    // Delete from Graph API if synced
    if (email.graphMessageId) {
        try {
            const accessToken = await authService.getValidAccessToken(userId);
            const graphService = createGraphService(accessToken);
            await graphService.deleteMessage(email.graphMessageId);
        } catch (error) {
            console.error('Failed to delete from Graph API:', error);
        }
    }

    await prisma.email.delete({
        where: { id: emailId },
    });
}

// =============================================================================
// Reply and Forward
// =============================================================================

/**
 * Replies to an email
 */
export async function replyToEmail(
    emailId: string,
    userId: string,
    body: string,
    replyAll = false
): Promise<void> {
    const email = await getEmail(emailId, userId);

    if (!email.graphMessageId) {
        throw new EmailSendError('Cannot reply to local-only email');
    }

    const accessToken = await authService.getValidAccessToken(userId);
    const graphService = createGraphService(accessToken);

    await graphService.replyToMessage(email.graphMessageId, body, replyAll);
}

/**
 * Forwards an email
 */
export async function forwardEmail(
    emailId: string,
    userId: string,
    to: { name?: string; address: string }[],
    comment?: string
): Promise<void> {
    const email = await getEmail(emailId, userId);

    if (!email.graphMessageId) {
        throw new EmailSendError('Cannot forward local-only email');
    }

    const accessToken = await authService.getValidAccessToken(userId);
    const graphService = createGraphService(accessToken);

    await graphService.forwardMessage(email.graphMessageId, to, comment);
}

// =============================================================================
// Attachment Operations
// =============================================================================

/**
 * Lists attachments for an email
 */
export async function getAttachments(emailId: string, userId: string): Promise<any[]> {
    const email = await getEmail(emailId, userId);

    if (!email.graphMessageId) {
        // If it's a local draft or something not synced, maybe check local DB?
        // For now, assume we fetch from Graph for received emails
        return prisma.emailAttachment.findMany({ where: { emailId } });
    }

    const accessToken = await authService.getValidAccessToken(userId);
    const graphService = createGraphService(accessToken);

    try {
        return await graphService.listAttachments(email.graphMessageId);
    } catch (error: any) {
        // Check for 404 and try to recover if we have internetMessageId
        if (error.statusCode === 404 && email.internetMessageId) {
            console.warn(
                `Attachment list failed for email ${emailId}. Attempting recovery via InternetMessageId...`
            );
            try {
                // Use $filter instead of $search for exact internetMessageId match
                const response = await graphService.listMessages({
                    filter: `internetMessageId eq '${email.internetMessageId}'`,
                    top: 1,
                    select: ['id', 'parentFolderId'],
                    folderId: null, // Search all folders
                });

                if (response.value && response.value.length > 0) {
                    const newMessage = response.value[0];
                    console.log(`Recovered email ${emailId}. New Graph ID: ${newMessage.id}`);

                    // Update local database with new IDs
                    await prisma.email.update({
                        where: { id: emailId },
                        data: {
                            graphMessageId: newMessage.id,
                            folderId: newMessage.parentFolderId,
                        },
                    });

                    // Retry with new ID
                    return await graphService.listAttachments(newMessage.id);
                }
            } catch (recoveryError) {
                console.warn('Recovery failed during listAttachments:', recoveryError);
            }
        }

        // Fallback to local DB if Graph fails or if we want to serve local data
        console.warn('Failed to fetch from Graph, falling back to local DB', error);
        return prisma.emailAttachment.findMany({ where: { emailId } });
    }
}

/**
 * Gets specific attachment content
 */
export async function getAttachmentContent(
    emailId: string,
    attachmentId: string,
    userId: string
): Promise<any> {
    const email = await getEmail(emailId, userId);

    if (!email.graphMessageId) {
        throw new Error('Cannot fetch attachment for this email');
    }

    const accessToken = await authService.getValidAccessToken(userId);
    const graphService = createGraphService(accessToken);

    try {
        return await graphService.getAttachment(email.graphMessageId, attachmentId);
    } catch (error: any) {
        // Check for 404 (ItemNotFound) and try to recover
        if (error.statusCode === 404 && email.internetMessageId) {
            console.warn(
                `Attachment fetch failed for email ${emailId}. Attempting recovery via InternetMessageId...`
            );

            try {
                // Use $filter instead of $search for exact internetMessageId match
                // InternetMessageId is immutable per RFC 5322, so we can use it to find the message
                const response = await graphService.listMessages({
                    filter: `internetMessageId eq '${email.internetMessageId}'`,
                    top: 1,
                    select: ['id', 'parentFolderId'],
                    folderId: null, // Search all folders
                });

                if (response.value && response.value.length > 0) {
                    const newMessage = response.value[0];
                    console.log(`Recovered email ${emailId}. New Graph ID: ${newMessage.id}`);

                    // Update local database with new IDs
                    await prisma.email.update({
                        where: { id: emailId },
                        data: {
                            graphMessageId: newMessage.id,
                            folderId: newMessage.parentFolderId,
                        },
                    });

                    // Fetch fresh attachment list from the recovered message
                    const freshAttachments = await graphService.listAttachments(newMessage.id);

                    if (freshAttachments.length === 0) {
                        throw new NotFoundError('No attachments found on recovered message');
                    }

                    // Try to find the attachment by matching with our local database
                    let matchedAttachment = null;

                    // First, try to find by the old Graph attachment ID (might still work in rare cases)
                    matchedAttachment = freshAttachments.find((a) => a.id === attachmentId);

                    // If not found, query our database for the attachment metadata
                    if (!matchedAttachment) {
                        const localAttachment = await prisma.emailAttachment.findFirst({
                            where: {
                                emailId: emailId,
                                graphAttachmentId: attachmentId,
                            },
                        });

                        if (localAttachment?.fileName) {
                            // Match by filename from our database
                            matchedAttachment = freshAttachments.find(
                                (a) => a.name === localAttachment.fileName
                            );

                            if (matchedAttachment) {
                                console.log(
                                    `Matched attachment by filename: ${localAttachment.fileName}`
                                );

                                // Update the database with the new Graph attachment ID
                                await prisma.emailAttachment.update({
                                    where: { id: localAttachment.id },
                                    data: { graphAttachmentId: matchedAttachment.id },
                                });
                            }
                        }
                    }

                    // Fallback: if there's only one attachment, use it
                    if (!matchedAttachment && freshAttachments.length === 1) {
                        matchedAttachment = freshAttachments[0];
                        console.log(
                            `Using single attachment as fallback: ${matchedAttachment.name}`
                        );
                    }

                    if (matchedAttachment) {
                        // Fetch the matched attachment content with the new ID
                        return await graphService.getAttachment(
                            newMessage.id,
                            matchedAttachment.id
                        );
                    } else {
                        throw new NotFoundError(
                            'Could not match attachment after message recovery'
                        );
                    }
                }
            } catch (recoveryError) {
                console.error('Recovery failed in getAttachmentContent:', recoveryError);
                // Fall through to throw original error
            }
        }

        throw error;
    }
}

// =============================================================================
// Service Export
// =============================================================================

export const emailService = {
    syncEmails,
    listEmails,
    getEmail,
    sendEmail,
    updateEmail,
    deleteEmail,
    replyToEmail,
    forwardEmail,
    getAttachments,
    getAttachmentContent,
};

export default emailService;
