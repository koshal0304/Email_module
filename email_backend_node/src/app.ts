// =============================================================================
// Express Application Entry Point
// =============================================================================
// Production-ready Express.js application with all middleware and routes
// =============================================================================

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { config } from './config';
import { checkDatabaseConnection, disconnectDatabase } from './config/database';
import { checkRedisConnection, disconnectRedis } from './config/redis';
import { checkElasticsearchConnection, ensureEmailIndex } from './config/elasticsearch';
import { errorHandler, notFoundHandler, rateLimiter, requestLogger, requestId } from './middleware';
import apiRouter from './routes';
import { createLogger } from './utils/logger';

const logger = createLogger('App');

// =============================================================================
// Application Setup
// =============================================================================

const app: Application = express();

// =============================================================================
// Trust Proxy (for rate limiting behind reverse proxy)
// =============================================================================

app.set('trust proxy', 1);

// =============================================================================
// Security Middleware
// =============================================================================

// Helmet for security headers
app.use(
    helmet({
        contentSecurityPolicy: config.isProduction,
        crossOriginEmbedderPolicy: false,
    })
);

// CORS
app.use(
    cors({
        origin: config.isDevelopment
            ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8501']
            : process.env.ALLOWED_ORIGINS?.split(',') || [],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    })
);

// =============================================================================
// Body Parsing
// =============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================================================
// Compression
// =============================================================================

app.use(compression());

// =============================================================================
// Logging
// =============================================================================

if (config.isDevelopment) {
    app.use(requestLogger);
} else {
    app.use(morgan('combined'));
}

app.use(requestId);

// =============================================================================
// Rate Limiting
// =============================================================================

app.use(rateLimiter);

// =============================================================================
// Health Check (before auth)
// =============================================================================

app.get('/health', async (_req, res) => {
    const dbHealthy = await checkDatabaseConnection().catch(() => false);
    const redisHealthy = await checkRedisConnection().catch(() => false);
    const esHealthy = await checkElasticsearchConnection().catch(() => false);

    const status = dbHealthy ? 'healthy' : 'unhealthy';

    res.status(dbHealthy ? 200 : 503).json({
        success: dbHealthy,
        data: {
            status,
            timestamp: new Date().toISOString(),
            services: {
                database: dbHealthy ? 'connected' : 'disconnected',
                redis: redisHealthy ? 'connected' : 'disconnected',
                elasticsearch: esHealthy ? 'connected' : 'disabled',
            },
            version: process.env.npm_package_version || '1.0.0',
            environment: config.env,
        },
    });
});

// =============================================================================
// API Routes
// =============================================================================

app.use('/api', apiRouter);

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        success: true,
        data: {
            name: 'Email Backend API',
            version: process.env.npm_package_version || '1.0.0',
            documentation: '/api/docs',
            health: '/health',
        },
    });
});

// =============================================================================
// Error Handling
// =============================================================================

app.use(notFoundHandler);
app.use(errorHandler);

// =============================================================================
// Graceful Shutdown
// =============================================================================

async function gracefulShutdown(signal: string): Promise<void> {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    try {
        // Close database connections
        await disconnectDatabase();

        // Close Redis connection
        await disconnectRedis();

        logger.info('Graceful shutdown completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =============================================================================
// Server Startup
// =============================================================================

async function startServer(): Promise<void> {
    try {
        logger.info('Starting Email Backend Server...');

        // Check database connection
        const dbConnected = await checkDatabaseConnection();
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }

        // Check Redis connection
        await checkRedisConnection();

        // Check Elasticsearch and ensure index exists
        if (config.elasticsearch.enabled) {
            await checkElasticsearchConnection();
            await ensureEmailIndex();
        }

        // Start listening
        app.listen(config.port, () => {
            logger.info('Email Backend Server started successfully', {
                port: config.port,
                environment: config.env,
                url: `http://localhost:${config.port}`,
                apiUrl: `http://localhost:${config.port}/api`,
                healthUrl: `http://localhost:${config.port}/health`,
            });
        });
    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
}

// =============================================================================
// Export for Testing
// =============================================================================

export { app, startServer };

// =============================================================================
// Start Server if Not Imported
// =============================================================================

if (require.main === module) {
    startServer();
}
