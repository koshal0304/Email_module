// =============================================================================
// Sync Service
// =============================================================================
// Email synchronization and webhook subscription management
// =============================================================================

import { prisma } from '../config/database';
import { config } from '../config';
import { authService } from './auth.service';
import { createGraphService } from './graph.service';
import { emailService } from './email.service';
import { EmailSyncError } from '../utils/exceptions';
import { SyncResult, SyncStatus } from '../types';

// =============================================================================
// Sync Status
// =============================================================================

/**
 * Gets the sync status for a user
 */
export async function getSyncStatus(userId: string): Promise<SyncStatus> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            lastEmailSyncTime: true,
            graphSubscriptionId: true,
            graphSubscriptionExpiresAt: true,
        },
    });

    if (!user) {
        throw new Error(`User ${userId} not found`);
    }

    return {
        userId: user.id,
        lastSyncTime: user.lastEmailSyncTime,
        isSyncing: false, // Would need to track this in Redis for real implementation
        subscriptionActive: !!(
            user.graphSubscriptionId &&
            user.graphSubscriptionExpiresAt &&
            user.graphSubscriptionExpiresAt > new Date()
        ),
        subscriptionExpiresAt: user.graphSubscriptionExpiresAt,
    };
}

// =============================================================================
// Manual Sync
// =============================================================================

/**
 * Triggers a manual email sync for a user
 */
export async function triggerSync(
    userId: string,
    options: {
        folderId?: string;
        fullSync?: boolean;
        maxEmails?: number;
    } = {}
): Promise<SyncResult> {
    try {
        const result = await emailService.syncEmails(userId, {
            folderId: options.folderId || 'inbox',
            maxEmails: options.maxEmails || (options.fullSync ? 500 : 100),
            fullSync: options.fullSync,
        });

        return {
            ...result,
            lastSyncTime: new Date(),
        };
    } catch (error) {
        console.error('Sync failed:', error);
        throw new EmailSyncError('Email synchronization failed');
    }
}

/**
 * Syncs all folders for a user
 */
export async function syncAllFolders(userId: string): Promise<SyncResult[]> {
    const accessToken = await authService.getValidAccessToken(userId);
    const graphService = createGraphService(accessToken);

    const folders = await graphService.listFolders();
    const results: SyncResult[] = [];

    for (const folder of folders) {
        try {
            const result = await triggerSync(userId, { folderId: folder.id });
            results.push(result);
        } catch (error) {
            console.error(`Failed to sync folder ${folder.displayName}:`, error);
        }
    }

    return results;
}

// =============================================================================
// Webhook Subscription Management
// =============================================================================

/**
 * Creates a webhook subscription for real-time email updates
 */
export async function createSubscription(userId: string): Promise<{
    subscriptionId: string;
    expiresAt: Date;
}> {
    if (!config.webhook.enabled || !config.webhook.notificationUrl) {
        throw new Error('Webhooks are not configured');
    }

    const accessToken = await authService.getValidAccessToken(userId);
    const graphService = createGraphService(accessToken);

    // Generate a unique client state for verification
    const clientState = `${userId}-${Date.now()}`;

    const subscription = await graphService.createSubscription(
        config.webhook.notificationUrl,
        clientState
    );

    // Store subscription info
    await prisma.user.update({
        where: { id: userId },
        data: {
            graphSubscriptionId: subscription.id,
            graphSubscriptionExpiresAt: new Date(subscription.expirationDateTime),
        },
    });

    return {
        subscriptionId: subscription.id,
        expiresAt: new Date(subscription.expirationDateTime),
    };
}

/**
 * Renews an existing webhook subscription
 */
export async function renewSubscription(userId: string): Promise<{
    subscriptionId: string;
    expiresAt: Date;
}> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { graphSubscriptionId: true },
    });

    if (!user?.graphSubscriptionId) {
        // No existing subscription, create new one
        return createSubscription(userId);
    }

    try {
        const accessToken = await authService.getValidAccessToken(userId);
        const graphService = createGraphService(accessToken);

        const subscription = await graphService.renewSubscription(user.graphSubscriptionId);

        await prisma.user.update({
            where: { id: userId },
            data: {
                graphSubscriptionExpiresAt: new Date(subscription.expirationDateTime),
            },
        });

        return {
            subscriptionId: subscription.id,
            expiresAt: new Date(subscription.expirationDateTime),
        };
    } catch (error) {
        console.error('Failed to renew subscription, creating new one:', error);
        return createSubscription(userId);
    }
}

/**
 * Deletes a webhook subscription
 */
export async function deleteSubscription(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { graphSubscriptionId: true },
    });

    if (!user?.graphSubscriptionId) {
        return;
    }

    try {
        const accessToken = await authService.getValidAccessToken(userId);
        const graphService = createGraphService(accessToken);
        await graphService.deleteSubscription(user.graphSubscriptionId);
    } catch (error) {
        console.error('Failed to delete subscription from Graph:', error);
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            graphSubscriptionId: null,
            graphSubscriptionExpiresAt: null,
        },
    });
}

/**
 * Renews all expiring subscriptions
 */
export async function renewExpiringSubscriptions(): Promise<{
    renewed: number;
    failed: number;
}> {
    const result = { renewed: 0, failed: 0 };

    // Find users with subscriptions expiring in the next 24 hours
    const expirationThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const users = await prisma.user.findMany({
        where: {
            graphSubscriptionId: { not: null },
            graphSubscriptionExpiresAt: { lte: expirationThreshold },
            isActive: true,
        },
        select: { id: true },
    });

    for (const user of users) {
        try {
            await renewSubscription(user.id);
            result.renewed++;
        } catch (error) {
            console.error(`Failed to renew subscription for user ${user.id}:`, error);
            result.failed++;
        }
    }

    return result;
}

// =============================================================================
// Background Sync
// =============================================================================

/**
 * Performs background sync for all active users
 */
export async function runBackgroundSync(): Promise<{
    usersProcessed: number;
    totalSynced: number;
    errors: number;
}> {
    const result = { usersProcessed: 0, totalSynced: 0, errors: 0 };

    // Find active users who haven't synced recently
    const syncThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes

    const users = await prisma.user.findMany({
        where: {
            isActive: true,
            accessToken: { not: null },
            OR: [{ lastEmailSyncTime: null }, { lastEmailSyncTime: { lte: syncThreshold } }],
        },
        select: { id: true },
        take: 50, // Limit batch size
    });

    for (const user of users) {
        try {
            const syncResult = await triggerSync(user.id);
            result.usersProcessed++;
            result.totalSynced += syncResult.synced;
        } catch (error) {
            console.error(`Background sync failed for user ${user.id}:`, error);
            result.errors++;
        }
    }

    return result;
}

// =============================================================================
// Service Export
// =============================================================================

export const syncService = {
    getSyncStatus,
    triggerSync,
    syncAllFolders,
    createSubscription,
    renewSubscription,
    deleteSubscription,
    renewExpiringSubscriptions,
    runBackgroundSync,
};

export default syncService;
