// =============================================================================
// Configuration - Environment Variables
// =============================================================================
// Centralized configuration management with Zod validation
// =============================================================================

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('Config');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// =============================================================================
// Environment Schema
// =============================================================================

const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3001'),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // Elasticsearch
    ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

    // Microsoft Azure AD
    AZURE_CLIENT_ID: z.string().min(1),
    AZURE_CLIENT_SECRET: z.string().min(1),
    AZURE_TENANT_ID: z.string().min(1),
    AZURE_REDIRECT_URI: z.string().url(),

    // Microsoft Graph API
    GRAPH_API_BASE_URL: z.string().default('https://graph.microsoft.com/v1.0'),
    GRAPH_API_SCOPES: z.string().default('User.Read,Mail.ReadWrite,Mail.Send,offline_access'),

    // Security
    JWT_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z.string().min(32),

    // Webhook
    WEBHOOK_SECRET: z.string().optional(),
    WEBHOOK_NOTIFICATION_URL: z.string().url().optional(),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

    // Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

    // Feature Flags
    ENABLE_ELASTICSEARCH: z
        .string()
        .transform((v) => v === 'true')
        .default('true'),
    ENABLE_BACKGROUND_SYNC: z
        .string()
        .transform((v) => v === 'true')
        .default('true'),
    ENABLE_WEBHOOKS: z
        .string()
        .transform((v) => v === 'true')
        .default('true'),
});

// =============================================================================
// Parse and Validate Environment
// =============================================================================

const parseEnv = () => {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missingVars = error.errors.map((e) => e.path.join('.')).join(', ');
            logger.error(`Missing or invalid environment variables: ${missingVars}`);
            logger.error('Please check your .env file');
            process.exit(1);
        }
        throw error;
    }
};

const env = parseEnv();

// =============================================================================
// Configuration Object
// =============================================================================

export const config = {
    // Environment
    env: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',

    // Server
    port: env.PORT,

    // Database
    databaseUrl: env.DATABASE_URL,

    // Redis
    redis: {
        url: env.REDIS_URL,
    },

    // Elasticsearch
    elasticsearch: {
        url: env.ELASTICSEARCH_URL,
        enabled: env.ENABLE_ELASTICSEARCH,
    },

    // Microsoft Azure AD / OAuth
    azure: {
        clientId: env.AZURE_CLIENT_ID,
        clientSecret: env.AZURE_CLIENT_SECRET,
        tenantId: env.AZURE_TENANT_ID,
        redirectUri: env.AZURE_REDIRECT_URI,
        authorityUrl: `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}`,
        authorizationEndpoint: `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/authorize`,
        tokenEndpoint: `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    },

    // Microsoft Graph API
    graph: {
        baseUrl: env.GRAPH_API_BASE_URL,
        scopes: env.GRAPH_API_SCOPES.split(','),
        scopeString: env.GRAPH_API_SCOPES.split(',').join(' '),
    },

    // Security
    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: '7d',
    },
    encryption: {
        key: env.ENCRYPTION_KEY,
    },

    // Webhook
    webhook: {
        secret: env.WEBHOOK_SECRET,
        notificationUrl: env.WEBHOOK_NOTIFICATION_URL,
        enabled: env.ENABLE_WEBHOOKS,
    },

    // Rate Limiting
    rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    },

    // Logging
    logLevel: env.LOG_LEVEL,

    // Pagination
    pagination: {
        defaultLimit: 50,
        maxLimit: 200,
    },

    // Sync
    sync: {
        defaultMaxEmails: 100,
        fullSyncBatchSize: 50,
        retryAttempts: 3,
        retryDelayMs: 1000,
    },

    // Threading
    threading: {
        timeWindowHours: 72,
        participantOverlapThreshold: 0.5,
    },

    // Feature Flags
    features: {
        elasticsearch: env.ENABLE_ELASTICSEARCH,
        backgroundSync: env.ENABLE_BACKGROUND_SYNC,
        webhooks: env.ENABLE_WEBHOOKS,
    },
} as const;

export type Config = typeof config;
export default config;
