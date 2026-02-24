# Tax Document Editor - Node.js + Express + Prisma

Enterprise-grade document editing platform with git-style diff tracking for BOP and NTR tax documents.

## Features
- ONLYOFFICE Document Editor - Native DOCX editing in browser
- Git-Style Diff Tracking - Visual comparison with additions/deletions
- PostgreSQL + Prisma ORM - Type-safe database operations
- JWT Authentication for ONLYOFFICE
- Audit Logging
- Auto-Save

## Quick Start

```bash
# Backend
cd backend && npm install
docker-compose up -d && sleep 30
npm run prisma:generate && npm run prisma:migrate
npm run dev

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Frontend**: React 18, Vite
- **Database**: PostgreSQL 16
- **Editor**: ONLYOFFICE Document Server
- **Diff Engine**: Google's diff-match-patch
