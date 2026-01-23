// =============================================================================
// Webhook Routes
// =============================================================================
// Microsoft Graph webhook notification endpoints
// =============================================================================

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware';
import { config } from '../config';
import { prisma } from '../config/database';
import { emailService, syncService } from '../services';
import { WebhookValidationError } from '../utils/exceptions';
import { GraphWebhookNotification } from '../types';

const router = Router();

// =============================================================================
// Webhook Validation
// =============================================================================

/**
 * POST /webhooks/notifications
 * Receives webhook notifications from Microsoft Graph
 */
router.post(
    '/notifications',
    asyncHandler(async (req: Request, res: Response) => {
        // Handle validation request from Microsoft Graph
        const validationToken = req.query.validationToken as string | undefined;

        if (validationToken) {
            // This is a subscription validation request
            console.log('Webhook validation request received');
            res.set('Content-Type', 'text/plain');
            res.status(200).send(validationToken);
            return;
        }

        // Verify webhook secret if configured
        if (config.webhook.secret) {
            const clientState = req.body?.value?.[0]?.clientState;
            if (clientState && !clientState.includes(config.webhook.secret)) {
                throw new WebhookValidationError('Invalid client state');
            }
        }

        // Process notifications (must respond quickly)
        res.status(202).json({ status: 'accepted' });

        // Process notifications asynchronously
        const notifications = req.body?.value as GraphWebhookNotification[] | undefined;

        if (notifications && Array.isArray(notifications)) {
            processNotificationsAsync(notifications);
        }
    })
);

/**
 * Processes webhook notifications asynchronously
 */
async function processNotificationsAsync(notifications: GraphWebhookNotification[]): Promise<void> {
    for (const notification of notifications) {
        try {
            await processNotification(notification);
        } catch (error) {
            console.error('Error processing notification:', error);
        }
    }
}

/**
 * Processes a single webhook notification
 */
async function processNotification(notification: GraphWebhookNotification): Promise<void> {
    const { subscriptionId, changeType, resourceData } = notification;

    console.log(`Processing webhook: ${changeType} for subscription ${subscriptionId}`);

    // Find user by subscription ID
    const user = await prisma.user.findFirst({
        where: { graphSubscriptionId: subscriptionId },
    });

    if (!user) {
        console.warn(`No user found for subscription ${subscriptionId}`);
        return;
    }

    // Handle different change types
    switch (changeType) {
        case 'created':
        case 'updated':
            // Sync the specific message
            try {
                await emailService.syncEmails(user.id, { maxEmails: 10 });
            } catch (error) {
                console.error(`Failed to sync for notification:`, error);
            }
            break;

        case 'deleted':
            // Handle message deletion
            if (resourceData?.id) {
                await prisma.email.deleteMany({
                    where: { graphMessageId: resourceData.id },
                });
            }
            break;

        default:
            console.log(`Unhandled change type: ${changeType}`);
    }
}

// =============================================================================
// Subscription Management
// =============================================================================

/**
 * POST /webhooks/subscribe
 * Creates a new webhook subscription for the current user
 */
router.post(
    '/subscribe',
    asyncHandler(async (req: Request, res: Response) => {
        // This requires authentication - import middleware
        const { authenticate } = await import('../middleware/auth');

        // Manually authenticate
        await new Promise<void>((resolve, reject) => {
            authenticate(req, res, (err?: unknown) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const userId = req.user!.id;

        const subscription = await syncService.createSubscription(userId);

        res.status(201).json({
            success: true,
            data: subscription,
        });
    })
);

/**
 * POST /webhooks/renew
 * Renews the webhook subscription for the current user
 */
router.post(
    '/renew',
    asyncHandler(async (req: Request, res: Response) => {
        const { authenticate } = await import('../middleware/auth');

        await new Promise<void>((resolve, reject) => {
            authenticate(req, res, (err?: unknown) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const userId = req.user!.id;

        const subscription = await syncService.renewSubscription(userId);

        res.json({
            success: true,
            data: subscription,
        });
    })
);

/**
 * DELETE /webhooks/unsubscribe
 * Deletes the webhook subscription for the current user
 */
router.delete(
    '/unsubscribe',
    asyncHandler(async (req: Request, res: Response) => {
        const { authenticate } = await import('../middleware/auth');

        await new Promise<void>((resolve, reject) => {
            authenticate(req, res, (err?: unknown) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const userId = req.user!.id;

        await syncService.deleteSubscription(userId);

        res.json({
            success: true,
            message: 'Subscription deleted successfully',
        });
    })
);

/**
 * GET /webhooks/status
 * Gets the current webhook subscription status
 */
router.get(
    '/status',
    asyncHandler(async (req: Request, res: Response) => {
        const { authenticate } = await import('../middleware/auth');

        await new Promise<void>((resolve, reject) => {
            authenticate(req, res, (err?: unknown) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const userId = req.user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                graphSubscriptionId: true,
                graphSubscriptionExpiresAt: true,
            },
        });

        const isActive = !!(
            user?.graphSubscriptionId &&
            user?.graphSubscriptionExpiresAt &&
            user.graphSubscriptionExpiresAt > new Date()
        );

        res.json({
            success: true,
            data: {
                subscriptionId: user?.graphSubscriptionId,
                expiresAt: user?.graphSubscriptionExpiresAt,
                isActive,
            },
        });
    })
);

export default router;
