// =============================================================================
// Workers Index
// =============================================================================
// Central export and startup for all workers
// =============================================================================

export {
    emailSyncQueue,
    startWorker,
    stopWorker,
    scheduleSyncForUser,
    scheduleNotificationProcessing,
    scheduleIndexEmails,
    setupRecurringJobs,
} from './email-sync.worker';
