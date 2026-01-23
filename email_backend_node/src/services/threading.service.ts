// =============================================================================
// Email Threading Engine
// =============================================================================
// Sophisticated multi-layer email threading algorithm
// =============================================================================

import { prisma } from '../config/database';
import { Email, EmailType, ThreadStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Types
// =============================================================================

interface ThreadingResult {
    threadId: string;
    isNewThread: boolean;
    matchedBy: ThreadingLayer;
}

type ThreadingLayer =
    | 'conversation_id'
    | 'tax_email_id'
    | 'internet_message_id'
    | 'in_reply_to'
    | 'references'
    | 'subject_participants'
    | 'new_thread';

// =============================================================================
// Subject Normalization
// =============================================================================

/**
 * Normalizes email subject for comparison
 * Removes RE:, FW:, FWD:, etc. and extra whitespace
 */
function normalizeSubject(subject: string): string {
    return subject
        .replace(/^(re|fwd?|fw):\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Extracts the base subject without reply/forward prefixes
 */
function extractBaseSubject(subject: string): string {
    // Recursively remove RE:, FW:, FWD: prefixes
    let normalized = subject.trim();
    let previous = '';

    while (normalized !== previous) {
        previous = normalized;
        normalized = normalized.replace(/^(re|fwd?|fw):\s*/i, '').trim();
    }

    return normalized;
}

// =============================================================================
// Participant Extraction
// =============================================================================

/**
 * Extracts unique email addresses from recipients
 */
function extractParticipants(email: {
    fromAddress: string;
    toRecipients: unknown;
    ccRecipients: unknown;
}): Set<string> {
    const participants = new Set<string>();

    // Add sender
    participants.add(email.fromAddress.toLowerCase());

    // Helper to extract addresses from JSON recipients
    const extractFromJson = (recipients: unknown): void => {
        if (!Array.isArray(recipients)) return;

        for (const recipient of recipients) {
            if (typeof recipient === 'object' && recipient !== null) {
                const addr = (recipient as Record<string, unknown>).address;
                if (typeof addr === 'string') {
                    participants.add(addr.toLowerCase());
                }
            }
        }
    };

    extractFromJson(email.toRecipients);
    extractFromJson(email.ccRecipients);

    return participants;
}

/**
 * Calculates participant overlap between two sets
 */
function calculateParticipantOverlap(set1: Set<string>, set2: Set<string>): number {
    let overlap = 0;
    for (const addr of set1) {
        if (set2.has(addr)) {
            overlap++;
        }
    }
    return overlap;
}

// =============================================================================
// Threading Layers
// =============================================================================

/**
 * Layer 1: Match by Microsoft Conversation ID
 */
async function matchByConversationId(conversationId: string | null): Promise<string | null> {
    if (!conversationId) return null;

    const existingThread = await prisma.emailThread.findFirst({
        where: { conversationId },
        select: { id: true },
    });

    return existingThread?.id || null;
}

/**
 * Layer 2: Match by custom Tax Email ID header
 */
async function matchByTaxEmailId(taxEmailId: string | null): Promise<string | null> {
    if (!taxEmailId) return null;

    const existingThread = await prisma.emailThread.findFirst({
        where: { taxEmailId },
        select: { id: true },
    });

    return existingThread?.id || null;
}

/**
 * Layer 3: Match by Internet Message ID (RFC 5322)
 */
async function matchByInternetMessageId(inReplyToId: string | null): Promise<string | null> {
    if (!inReplyToId) return null;

    const parentEmail = await prisma.email.findFirst({
        where: { internetMessageId: inReplyToId },
        select: { threadId: true },
    });

    return parentEmail?.threadId || null;
}

/**
 * Layer 4: Match by In-Reply-To header
 */
async function matchByInReplyTo(inReplyToId: string | null): Promise<string | null> {
    if (!inReplyToId) return null;

    // Clean the message ID
    const cleanId = inReplyToId.replace(/[<>]/g, '');

    const parentEmail = await prisma.email.findFirst({
        where: {
            OR: [
                { internetMessageId: cleanId },
                { internetMessageId: `<${cleanId}>` },
                { graphMessageId: cleanId },
            ],
        },
        select: { threadId: true },
    });

    return parentEmail?.threadId || null;
}

/**
 * Layer 5: Match by References header
 */
async function matchByReferences(references: string | null): Promise<string | null> {
    if (!references) return null;

    // Parse references (space-separated list of message IDs)
    const messageIds = references
        .split(/\s+/)
        .map((id) => id.replace(/[<>]/g, '').trim())
        .filter((id) => id.length > 0);

    if (messageIds.length === 0) return null;

    // Try to find any email matching these references
    for (const msgId of messageIds) {
        const email = await prisma.email.findFirst({
            where: {
                OR: [{ internetMessageId: msgId }, { internetMessageId: `<${msgId}>` }],
            },
            select: { threadId: true },
        });

        if (email) {
            return email.threadId;
        }
    }

    return null;
}

/**
 * Layer 6: Match by subject and participants
 */
async function matchBySubjectAndParticipants(
    subject: string,
    email: {
        fromAddress: string;
        toRecipients: unknown;
        ccRecipients: unknown;
    },
    timeWindowHours = 72
): Promise<string | null> {
    const normalizedSubject = normalizeSubject(extractBaseSubject(subject));
    const participants = extractParticipants(email);

    if (normalizedSubject.length < 5) {
        // Subject too short for reliable matching
        return null;
    }

    // Find threads with similar subjects in the time window
    const cutoffDate = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

    const candidateThreads = await prisma.emailThread.findMany({
        where: {
            lastActivityAt: { gte: cutoffDate },
        },
        include: {
            emails: {
                take: 5,
                orderBy: { receivedDateTime: 'desc' },
                select: {
                    fromAddress: true,
                    toRecipients: true,
                    ccRecipients: true,
                },
            },
        },
    });

    for (const thread of candidateThreads) {
        const threadNormalizedSubject = normalizeSubject(extractBaseSubject(thread.subject));

        if (threadNormalizedSubject !== normalizedSubject) {
            continue;
        }

        // Check participant overlap
        for (const threadEmail of thread.emails) {
            const threadParticipants = extractParticipants(threadEmail);
            const overlap = calculateParticipantOverlap(participants, threadParticipants);

            // Require at least 2 common participants
            if (overlap >= 2) {
                return thread.id;
            }
        }
    }

    return null;
}

// =============================================================================
// Main Threading Function
// =============================================================================

/**
 * Finds or creates a thread for an email using the multi-layer algorithm
 */
export async function findOrCreateThread(emailData: {
    subject: string;
    fromAddress: string;
    toRecipients: unknown;
    ccRecipients: unknown;
    conversationId?: string | null;
    taxEmailId?: string | null;
    inReplyToId?: string | null;
    references?: string | null;
    emailType?: EmailType | null;
    clientId?: string | null;
}): Promise<ThreadingResult> {
    // Layer 1: Conversation ID
    let threadId = await matchByConversationId(emailData.conversationId || null);
    if (threadId) {
        return { threadId, isNewThread: false, matchedBy: 'conversation_id' };
    }

    // Layer 2: Tax Email ID
    threadId = await matchByTaxEmailId(emailData.taxEmailId || null);
    if (threadId) {
        return { threadId, isNewThread: false, matchedBy: 'tax_email_id' };
    }

    // Layer 3: Internet Message ID
    threadId = await matchByInternetMessageId(emailData.inReplyToId || null);
    if (threadId) {
        return { threadId, isNewThread: false, matchedBy: 'internet_message_id' };
    }

    // Layer 4: In-Reply-To
    threadId = await matchByInReplyTo(emailData.inReplyToId || null);
    if (threadId) {
        return { threadId, isNewThread: false, matchedBy: 'in_reply_to' };
    }

    // Layer 5: References
    threadId = await matchByReferences(emailData.references || null);
    if (threadId) {
        return { threadId, isNewThread: false, matchedBy: 'references' };
    }

    // Layer 6: Subject + Participants
    threadId = await matchBySubjectAndParticipants(emailData.subject, {
        fromAddress: emailData.fromAddress,
        toRecipients: emailData.toRecipients,
        ccRecipients: emailData.ccRecipients,
    });
    if (threadId) {
        return { threadId, isNewThread: false, matchedBy: 'subject_participants' };
    }

    // Layer 7: Create new thread
    const newThread = await prisma.emailThread.create({
        data: {
            id: uuidv4(),
            subject: emailData.subject,
            conversationId: emailData.conversationId,
            taxEmailId: emailData.taxEmailId,
            emailType: emailData.emailType,
            clientId: emailData.clientId,
            status: 'awaiting_reply',
            messageCount: 0,
            lastActivityAt: new Date(),
        },
    });

    return { threadId: newThread.id, isNewThread: true, matchedBy: 'new_thread' };
}

// =============================================================================
// Thread Update Functions
// =============================================================================

/**
 * Updates thread metadata after an email is added
 */
export async function updateThreadAfterEmail(threadId: string, email: Email): Promise<void> {
    const thread = await prisma.emailThread.findUnique({
        where: { id: threadId },
        include: {
            emails: {
                orderBy: { receivedDateTime: 'asc' },
                select: { id: true, direction: true, receivedDateTime: true },
            },
        },
    });

    if (!thread) return;

    const emailCount = thread.emails.length;
    const firstEmail = thread.emails[0];
    const lastEmail = thread.emails[emailCount - 1];

    // Determine thread status
    let newStatus: ThreadStatus = thread.status;
    if (email.direction === 'outgoing') {
        newStatus = 'replied';
    } else if (email.direction === 'incoming' && thread.status === 'replied') {
        newStatus = 'awaiting_reply';
    }

    await prisma.emailThread.update({
        where: { id: threadId },
        data: {
            messageCount: emailCount,
            firstMessageId: firstEmail?.id,
            lastMessageId: lastEmail?.id,
            lastActivityAt: email.receivedDateTime || new Date(),
            status: newStatus,
            conversationId: thread.conversationId || email.conversationId,
        },
    });
}

/**
 * Recalculates thread for an email (for re-threading)
 */
export async function rethreadEmail(emailId: string): Promise<ThreadingResult> {
    const email = await prisma.email.findUnique({
        where: { id: emailId },
        include: { thread: true },
    });

    if (!email) {
        throw new Error(`Email ${emailId} not found`);
    }

    const oldThreadId = email.threadId;

    const result = await findOrCreateThread({
        subject: email.subject,
        fromAddress: email.fromAddress,
        toRecipients: email.toRecipients,
        ccRecipients: email.ccRecipients,
        conversationId: email.conversationId,
        taxEmailId: email.taxEmailId,
        inReplyToId: email.inReplyToId,
        references: email.references,
        emailType: email.emailType,
        clientId: email.clientId,
    });

    if (result.threadId !== oldThreadId) {
        // Move email to new thread
        await prisma.email.update({
            where: { id: emailId },
            data: { threadId: result.threadId },
        });

        // Update both threads
        await updateThreadAfterEmail(result.threadId, email);

        // Check if old thread is now empty
        const oldThreadEmailCount = await prisma.email.count({
            where: { threadId: oldThreadId },
        });

        if (oldThreadEmailCount === 0) {
            await prisma.emailThread.delete({
                where: { id: oldThreadId },
            });
        } else {
            // Recalculate old thread metadata
            const remainingEmails = await prisma.email.findMany({
                where: { threadId: oldThreadId },
                orderBy: { receivedDateTime: 'asc' },
            });

            if (remainingEmails.length > 0) {
                await updateThreadAfterEmail(
                    oldThreadId,
                    remainingEmails[remainingEmails.length - 1]
                );
            }
        }
    }

    return result;
}

// =============================================================================
// Service Export
// =============================================================================

export const threadingEngine = {
    findOrCreateThread,
    updateThreadAfterEmail,
    rethreadEmail,
    normalizeSubject,
    extractBaseSubject,
    extractParticipants,
};

export default threadingEngine;
