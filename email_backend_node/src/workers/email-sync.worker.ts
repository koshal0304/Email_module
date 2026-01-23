// =============================================================================
// Email Sync Worker
// =============================================================================
// BullMQ worker for background email synchronization
// =============================================================================

import { Worker, Queue, Job } from 'bullmq';
import { config } from '../config';
import { syncService, emailService, searchService } from '../services';
import { prisma } from '../config/database';

// =============================================================================
// Queue Configuration
// =============================================================================

const QUEUE_NAME = 'email-sync';

const connection = {
    host: new URL(config.redis.url).hostname || 'localhost',
    port: parseInt(new URL(config.redis.url).port || '6379'),
};

// =============================================================================
// Queue Instance
// =============================================================================

export const emailSyncQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
    },
});

// =============================================================================
// Job Types
// =============================================================================

interface SyncUserJobData {
    type: 'sync_user';
    userId: string;
    fullSync?: boolean;
}

interface ProcessNotificationJobData {
    type: 'process_notification';
    userId: string;
    messageId: string;
    changeType: string;
}

interface RenewSubscriptionsJobData {
    type: 'renew_subscriptions';
}

interface BackgroundSyncJobData {
    type: 'background_sync';
}

interface IndexEmailsJobData {
    type: 'index_emails';
    emailIds: string[];
}

type JobData =
    | SyncUserJobData
    | ProcessNotificationJobData
    | RenewSubscriptionsJobData
    | BackgroundSyncJobData
    | IndexEmailsJobData;

// =============================================================================
// Job Processor
// =============================================================================

async function processJob(job: Job<JobData>): Promise<unknown> {
    const { data } = job;

    console.log(`Processing job ${job.id} of type ${data.type}`);

    switch (data.type) {
        case 'sync_user':
            return processSyncUserJob(data);

        case 'process_notification':
            return processNotificationJob(data);

        case 'renew_subscriptions':
            return processRenewSubscriptionsJob();

        case 'background_sync':
            return processBackgroundSyncJob();

        case 'index_emails':
            return processIndexEmailsJob(data);

        default:
            throw new Error(`Unknown job type: ${(data as JobData).type}`);
    }
}

// =============================================================================
// Job Handlers
// =============================================================================

async function processSyncUserJob(data: SyncUserJobData): Promise<object> {
    const { userId, fullSync } = data;

    console.log(`Syncing emails for user ${userId}`);

    const result = await emailService.syncEmails(userId, {
        fullSync,
        maxEmails: fullSync ? 500 : 100,
    });

    return result;
}

async function processNotificationJob(data: ProcessNotificationJobData): Promise<void> {
    const { userId, changeType } = data;

    console.log(`Processing notification for user ${userId}: ${changeType}`);

    // Trigger a quick sync for the user
    await emailService.syncEmails(userId, { maxEmails: 10 });
}

async function processRenewSubscriptionsJob(): Promise<object> {
    console.log('Renewing expiring subscriptions');

    const result = await syncService.renewExpiringSubscriptions();

    console.log(`Renewed ${result.renewed} subscriptions, ${result.failed} failed`);

    return result;
}

async function processBackgroundSyncJob(): Promise<object> {
    console.log('Running background sync');

    const result = await syncService.runBackgroundSync();

    console.log(
        `Background sync: processed ${result.usersProcessed} users, ` +
            `synced ${result.totalSynced} emails, ${result.errors} errors`
    );

    return result;
}

async function processIndexEmailsJob(data: IndexEmailsJobData): Promise<object> {
    const { emailIds } = data;

    console.log(`Indexing ${emailIds.length} emails`);

    const emails = await prisma.email.findMany({
        where: { id: { in: emailIds } },
    });

    const result = await searchService.bulkIndexEmails(emails);

    return result;
}

// =============================================================================
// Worker Instance
// =============================================================================

let worker: Worker<JobData> | null = null;

export function startWorker(): Worker<JobData> {
    if (worker) {
        return worker;
    }

    worker = new Worker<JobData>(QUEUE_NAME, processJob, {
        connection,
        concurrency: 5,
    });

    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
        console.error(`Job ${job?.id} failed:`, error);
    });

    worker.on('error', (error) => {
        console.error('Worker error:', error);
    });

    console.log('Email sync worker started');

    return worker;
}

export function stopWorker(): Promise<void> {
    if (worker) {
        return worker.close();
    }
    return Promise.resolve();
}

// =============================================================================
// Job Schedulers
// =============================================================================

export async function scheduleSyncForUser(
    userId: string,
    options?: { fullSync?: boolean; delay?: number }
): Promise<void> {
    await emailSyncQueue.add(
        `sync-${userId}`,
        {
            type: 'sync_user',
            userId,
            fullSync: options?.fullSync,
        },
        {
            delay: options?.delay,
            jobId: `sync-${userId}-${Date.now()}`,
        }
    );
}

export async function scheduleNotificationProcessing(
    userId: string,
    messageId: string,
    changeType: string
): Promise<void> {
    await emailSyncQueue.add(
        `notification-${userId}-${messageId}`,
        {
            type: 'process_notification',
            userId,
            messageId,
            changeType,
        },
        {
            priority: 1, // High priority
            jobId: `notification-${userId}-${messageId}-${Date.now()}`,
        }
    );
}

export async function scheduleIndexEmails(emailIds: string[]): Promise<void> {
    await emailSyncQueue.add(
        `index-${Date.now()}`,
        {
            type: 'index_emails',
            emailIds,
        },
        {
            priority: 5, // Lower priority
        }
    );
}

// =============================================================================
// Recurring Jobs Setup
// =============================================================================

export async function setupRecurringJobs(): Promise<void> {
    // Background sync every 15 minutes
    await emailSyncQueue.add(
        'background-sync',
        { type: 'background_sync' },
        {
            repeat: {
                pattern: '*/15 * * * *', // Every 15 minutes
            },
            jobId: 'recurring-background-sync',
        }
    );

    // Renew subscriptions every 12 hours
    await emailSyncQueue.add(
        'renew-subscriptions',
        { type: 'renew_subscriptions' },
        {
            repeat: {
                pattern: '0 */12 * * *', // Every 12 hours
            },
            jobId: 'recurring-renew-subscriptions',
        }
    );

    console.log('Recurring jobs scheduled');
}
