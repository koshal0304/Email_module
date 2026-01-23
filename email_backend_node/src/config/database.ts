// =============================================================================
// Database Configuration - Prisma Client
// =============================================================================
// Singleton pattern for Prisma client to prevent connection exhaustion
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { config } from './index';
import { createLogger } from '../utils/logger';

const logger = createLogger('Database');

// =============================================================================
// Prisma Client Singleton
// =============================================================================

declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

const prismaClientOptions = {
    log: config.isDevelopment
        ? (['query', 'info', 'warn', 'error'] as const)
        : (['error'] as const),
};

export const prisma = global.prisma || new PrismaClient(prismaClientOptions as any);

if (config.isDevelopment) {
    global.prisma = prisma;
}

// =============================================================================
// Database Health Check
// =============================================================================

export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        await prisma.$queryRaw`SELECT 1`;
        logger.info('Database connection established');
        return true;
    } catch (error) {
        logger.error('Database connection failed', error);
        return false;
    }
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
    logger.info('Database connection closed');
}

export default prisma;
