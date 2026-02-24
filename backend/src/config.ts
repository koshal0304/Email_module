import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
    port: Number(process.env.PORT || 8000),
    env: process.env.NODE_ENV || 'development',

    // ONLYOFFICE
    onlyofficeUrl: process.env.ONLYOFFICE_URL || 'http://localhost:80',
    onlyofficeJwtSecret: process.env.ONLYOFFICE_JWT_SECRET || 'change_me_onlyoffice_jwt',

    // Storage
    storageRoot: path.resolve(process.env.STORAGE_ROOT || './uploads'),

    // CORS
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),

    // JWT (for API auth if needed)
    jwtSecret: process.env.JWT_SECRET || 'change_me_api_jwt',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
