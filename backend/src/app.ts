import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import documentsRouter from './routes/documents';
import diffRouter from './routes/diff';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
}));

// Static files (if needed)
app.use('/files', express.static(path.join(config.storageRoot)));

// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.env,
    });
});

app.get('/', (_req, res) => {
    res.json({
        message: 'Tax Document Editor API - Node.js + Express + Prisma',
        version: '1.0.0',
        endpoints: {
            documents: '/api/documents',
            diff: '/api/diff',
            health: '/health',
        },
    });
});

// Routes
app.use('/api/documents', documentsRouter);
app.use('/api/diff', diffRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);

    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        error: {
            message,
            status,
            ...(config.env === 'development' && { stack: err.stack }),
        },
    });
});

export default app;
