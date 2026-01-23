// =============================================================================
// Redis Client Configuration
// =============================================================================
// Singleton pattern for Redis connection with automatic reconnection
// =============================================================================

import Redis from 'ioredis';
import { config } from './index';
import { createLogger } from '../utils/logger';

const logger = createLogger('Redis');

// =============================================================================
// Redis Client Singleton
// =============================================================================

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis(config.redis.url, {
            maxRetriesPerRequest: 3,
            retryStrategy(times: number) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            lazyConnect: true,
        });

        redisClient.on('connect', () => {
            logger.info('Redis connection established');
        });

        redisClient.on('error', (error) => {
            logger.error('Redis connection error', error);
        });

        redisClient.on('close', () => {
            logger.info('Redis connection closed');
        });
    }

    return redisClient;
}

// =============================================================================
// Redis Health Check
// =============================================================================

export async function checkRedisConnection(): Promise<boolean> {
    try {
        const client = getRedisClient();
        await client.ping();
        logger.info('Redis connection verified');
        return true;
    } catch (error) {
        logger.error('Redis connection failed', error);
        return false;
    }
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

export async function disconnectRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        logger.info('Redis disconnected');
    }
}

export default getRedisClient;
