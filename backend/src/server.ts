import app from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  Tax Document Editor API - Node.js + Express + Prisma     ║
╠════════════════════════════════════════════════════════════╣
║  Server:      http://localhost:${config.port}                       ║
║  Environment: ${config.env.padEnd(43)}║
║  ONLYOFFICE:  ${config.onlyofficeUrl.padEnd(43)}║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
