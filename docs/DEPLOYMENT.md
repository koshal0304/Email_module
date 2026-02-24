# Deployment Guide

## Prerequisites
- Docker and Docker Compose
- Node.js 18+ and npm
- PostgreSQL 16+

## Development Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env
docker-compose up -d
sleep 30
npm run prisma:generate
npm run prisma:migrate
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Access URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- ONLYOFFICE: http://localhost:80
- Prisma Studio: http://localhost:5555
