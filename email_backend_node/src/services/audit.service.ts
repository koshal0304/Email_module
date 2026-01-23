// =============================================================================
// Audit Service
// =============================================================================
// Audit logging for compliance and activity tracking
// =============================================================================

import { prisma } from '../config/database';
import { AuditAction, AuditLogEntry } from '../types';
import { AuditLog, Prisma } from '@prisma/client';

// =============================================================================
// Audit Actions
// =============================================================================

export const AUDIT_ACTIONS: Record<AuditAction, string> = {
    viewed: 'Email viewed',
    sent: 'Email sent',
    replied: 'Email replied',
    forwarded: 'Email forwarded',
    deleted: 'Email deleted',
    archived: 'Email archived',
    flagged: 'Email flagged',
    marked_read: 'Email marked as read',
    marked_unread: 'Email marked as unread',
    thread_resolved: 'Thread resolved',
    thread_archived: 'Thread archived',
    client_linked: 'Client linked',
    synced: 'Emails synced',
};

// =============================================================================
// Create Audit Log
// =============================================================================

/**
 * Creates an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<AuditLog> {
    const data: Prisma.AuditLogCreateInput = {
        action: entry.action,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        details: (entry.details || {}) as Prisma.InputJsonValue,
    };

    if (entry.userId) {
        data.user = { connect: { id: entry.userId } };
    }

    if (entry.emailId) {
        data.email = { connect: { id: entry.emailId } };
    }

    if (entry.threadId) {
        data.thread = { connect: { id: entry.threadId } };
    }

    if (entry.clientId) {
        data.client = { connect: { id: entry.clientId } };
    }

    return prisma.auditLog.create({ data });
}

/**
 * Logs an email action
 */
export async function logEmailAction(
    userId: string,
    emailId: string,
    action: AuditAction,
    options?: {
        ipAddress?: string;
        userAgent?: string;
        details?: Record<string, unknown>;
    }
): Promise<void> {
    await createAuditLog({
        userId,
        emailId,
        action,
        ...options,
    });
}

/**
 * Logs a thread action
 */
export async function logThreadAction(
    userId: string,
    threadId: string,
    action: AuditAction,
    options?: {
        ipAddress?: string;
        userAgent?: string;
        details?: Record<string, unknown>;
    }
): Promise<void> {
    await createAuditLog({
        userId,
        threadId,
        action,
        ...options,
    });
}

/**
 * Logs a client action
 */
export async function logClientAction(
    userId: string,
    clientId: string,
    action: AuditAction,
    options?: {
        ipAddress?: string;
        userAgent?: string;
        details?: Record<string, unknown>;
    }
): Promise<void> {
    await createAuditLog({
        userId,
        clientId,
        action,
        ...options,
    });
}

// =============================================================================
// Query Audit Logs
// =============================================================================

/**
 * Gets audit logs for a user
 */
export async function getUserAuditLogs(
    userId: string,
    options: {
        page?: number;
        limit?: number;
        action?: AuditAction;
        startDate?: Date;
        endDate?: Date;
    } = {}
): Promise<{ logs: AuditLog[]; total: number }> {
    const { page = 1, limit = 50, action, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = { userId };

    if (action) {
        where.action = action;
    }

    if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
            where.timestamp.gte = startDate;
        }
        if (endDate) {
            where.timestamp.lte = endDate;
        }
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { timestamp: 'desc' },
            include: {
                email: { select: { subject: true } },
                thread: { select: { subject: true } },
                client: { select: { name: true } },
            },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
}

/**
 * Gets audit logs for an email
 */
export async function getEmailAuditLogs(emailId: string): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
        where: { emailId },
        orderBy: { timestamp: 'desc' },
        include: {
            user: { select: { email: true, firstName: true, lastName: true } },
        },
    });
}

/**
 * Gets audit logs for a thread
 */
export async function getThreadAuditLogs(threadId: string): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
        where: { threadId },
        orderBy: { timestamp: 'desc' },
        include: {
            user: { select: { email: true, firstName: true, lastName: true } },
        },
    });
}

/**
 * Gets audit logs for a client
 */
export async function getClientAuditLogs(
    clientId: string,
    options: {
        page?: number;
        limit?: number;
    } = {}
): Promise<{ logs: AuditLog[]; total: number }> {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where: { clientId },
            skip,
            take: limit,
            orderBy: { timestamp: 'desc' },
            include: {
                user: { select: { email: true, firstName: true, lastName: true } },
                email: { select: { subject: true } },
            },
        }),
        prisma.auditLog.count({ where: { clientId } }),
    ]);

    return { logs, total };
}

// =============================================================================
// Audit Statistics
// =============================================================================

/**
 * Gets audit statistics for a user
 */
export async function getAuditStats(
    userId: string,
    days = 30
): Promise<Record<AuditAction, number>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.auditLog.groupBy({
        by: ['action'],
        where: {
            userId,
            timestamp: { gte: startDate },
        },
        _count: { action: true },
    });

    const stats: Record<string, number> = {};

    for (const log of logs) {
        stats[log.action] = log._count.action;
    }

    // Ensure all actions have a value
    for (const action of Object.keys(AUDIT_ACTIONS)) {
        if (!(action in stats)) {
            stats[action] = 0;
        }
    }

    return stats as Record<AuditAction, number>;
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Removes old audit logs (for data retention compliance)
 */
export async function cleanupOldLogs(retentionDays = 365): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await prisma.auditLog.deleteMany({
        where: { timestamp: { lt: cutoffDate } },
    });

    return result.count;
}

// =============================================================================
// Service Export
// =============================================================================

export const auditService = {
    AUDIT_ACTIONS,
    createAuditLog,
    logEmailAction,
    logThreadAction,
    logClientAction,
    getUserAuditLogs,
    getEmailAuditLogs,
    getThreadAuditLogs,
    getClientAuditLogs,
    getAuditStats,
    cleanupOldLogs,
};

export default auditService;
