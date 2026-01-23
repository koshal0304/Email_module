// =============================================================================
// Routes Index
// =============================================================================
// Central export and configuration for all routes
// =============================================================================

import { Router } from 'express';
import authRoutes from './auth.routes';
import emailsRoutes from './emails.routes';
import threadsRoutes from './threads.routes';
import webhooksRoutes from './webhooks.routes';
import searchRoutes from './search.routes';
import clientsRoutes from './clients.routes';
import templatesRoutes from './templates.routes';

// =============================================================================
// API Router
// =============================================================================

const apiRouter = Router();

// Health check
apiRouter.get('/health', (_req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
        },
    });
});

// Mount routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/emails', emailsRoutes);
apiRouter.use('/threads', threadsRoutes);
apiRouter.use('/webhooks', webhooksRoutes);
apiRouter.use('/search', searchRoutes);
apiRouter.use('/clients', clientsRoutes);
apiRouter.use('/templates', templatesRoutes);

export default apiRouter;

// Export individual route modules
export {
    authRoutes,
    emailsRoutes,
    threadsRoutes,
    webhooksRoutes,
    searchRoutes,
    clientsRoutes,
    templatesRoutes,
};
