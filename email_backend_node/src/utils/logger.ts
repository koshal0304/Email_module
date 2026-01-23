// =============================================================================
// Centralized Logger Utility
// =============================================================================
// Winston-based structured logging to replace console.log/console.error
// =============================================================================

import winston from 'winston';

// =============================================================================
// Log Levels
// =============================================================================

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

// =============================================================================
// Logger Configuration
// =============================================================================

// Use environment variable directly to avoid circular dependency issues
const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = winston.createLogger({
    levels: logLevels,
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'email-backend' },
    transports: [
        // Error logs in separate file
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // All logs combined
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// In development, also log to console with colorized output
if (isDevelopment) {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message, timestamp, context, ...meta }) => {
                    const ctx = context ? `[${context}]` : '';
                    const metaStr = Object.keys(meta).length
                        ? `\n${JSON.stringify(meta, null, 2)}`
                        : '';
                    return `${timestamp} ${level} ${ctx} ${message}${metaStr}`;
                })
            ),
        })
    );
}

// =============================================================================
// Logger Factory
// =============================================================================

export interface Logger {
    info(message: string, meta?: Record<string, unknown>): void;
    error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Creates a context-aware logger
 * @param context - The context/module name for the logger
 * @returns Logger instance with context
 */
export function createLogger(context: string): Logger {
    return {
        info: (message: string, meta?: Record<string, unknown>) => {
            logger.info(message, { context, ...meta });
        },

        error: (message: string, error?: Error | unknown, meta?: Record<string, unknown>) => {
            if (error instanceof Error) {
                logger.error(message, {
                    context,
                    error: {
                        name: error.name,
                        message: error.message,
                        stack: error.stack,
                    },
                    ...meta,
                });
            } else {
                logger.error(message, { context, error, ...meta });
            }
        },

        warn: (message: string, meta?: Record<string, unknown>) => {
            logger.warn(message, { context, ...meta });
        },

        debug: (message: string, meta?: Record<string, unknown>) => {
            logger.debug(message, { context, ...meta });
        },
    };
}

// =============================================================================
// Default Logger Export
// =============================================================================

export const defaultLogger = createLogger('app');

export default logger;
