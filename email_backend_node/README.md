# Email Backend - Node.js/Express.js

Production-ready email backend module built with Express.js, TypeScript, Prisma, and PostgreSQL. Features Microsoft Graph API integration for Outlook email management.

## Features

- 🔐 **Microsoft OAuth 2.0** - Secure authentication with Azure AD
- 📧 **Email Management** - Full CRUD with sync from Outlook
- 🧵 **Advanced Threading** - 7-layer email threading algorithm
- 🔍 **Full-Text Search** - Elasticsearch powered search
- 📊 **Email Classification** - Tax-specific document categorization
- 🔔 **Real-time Updates** - Microsoft Graph webhook integration
- 📝 **Templates & Signatures** - Reusable email components
- 📋 **Audit Logging** - Compliance-ready activity tracking
- ⚡ **Background Tasks** - BullMQ for async processing

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Cache/Queue | Redis + BullMQ |
| Search | Elasticsearch |
| Auth | JWT + OAuth 2.0 |
| API | Microsoft Graph |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- (Optional) Elasticsearch

### Installation

```bash
# Navigate to project
cd email_backend_node

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
nano .env

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

### Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/email_module
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_secret
AZURE_TENANT_ID=your_tenant_id
AZURE_REDIRECT_URI=http://localhost:3001/api/auth/callback
JWT_SECRET=your_32_char_jwt_secret
ENCRYPTION_KEY=your_32_char_encryption_key

# Optional
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
```

## Project Structure

```
src/
├── app.ts              # Express application entry
├── config/             # Configuration & database clients
│   ├── index.ts        # Environment config
│   ├── database.ts     # Prisma client
│   ├── redis.ts        # Redis client
│   └── elasticsearch.ts
├── middleware/         # Express middleware
│   ├── auth.ts         # JWT authentication
│   ├── errorHandler.ts # Error handling
│   ├── rateLimiter.ts  # Rate limiting
│   └── logger.ts       # Request logging
├── routes/             # API endpoints
│   ├── auth.routes.ts
│   ├── emails.routes.ts
│   ├── threads.routes.ts
│   ├── webhooks.routes.ts
│   ├── search.routes.ts
│   ├── clients.routes.ts
│   └── templates.routes.ts
├── services/           # Business logic
│   ├── auth.service.ts
│   ├── graph.service.ts
│   ├── email.service.ts
│   ├── threading.service.ts
│   ├── sync.service.ts
│   ├── search.service.ts
│   ├── classification.service.ts
│   └── audit.service.ts
├── utils/              # Utilities
│   ├── encryption.ts
│   ├── validators.ts
│   └── exceptions.ts
├── workers/            # Background jobs
│   └── email-sync.worker.ts
├── types/              # TypeScript types
│   └── index.ts
prisma/
└── schema.prisma       # Database schema
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/login` | Get OAuth login URL |
| GET | `/api/auth/callback` | OAuth callback |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get profile |

### Emails
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/emails` | List emails |
| GET | `/api/emails/:id` | Get email |
| POST | `/api/emails` | Send email |
| PATCH | `/api/emails/:id` | Update email |
| DELETE | `/api/emails/:id` | Delete email |
| POST | `/api/emails/:id/reply` | Reply to email |
| POST | `/api/emails/:id/forward` | Forward email |
| POST | `/api/emails/sync` | Trigger sync |

### Threads
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/threads` | List threads |
| GET | `/api/threads/:id` | Get thread |
| PATCH | `/api/threads/:id` | Update thread |
| POST | `/api/threads/:id/resolve` | Resolve thread |
| POST | `/api/threads/:id/archive` | Archive thread |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Search emails |
| GET | `/api/search/suggestions` | Get suggestions |
| GET | `/api/search/filters` | Get filter options |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/notifications` | Receive notifications |
| POST | `/api/webhooks/subscribe` | Create subscription |
| POST | `/api/webhooks/renew` | Renew subscription |
| DELETE | `/api/webhooks/unsubscribe` | Delete subscription |

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List clients |
| GET | `/api/clients/:id` | Get client |
| POST | `/api/clients` | Create client |
| PATCH | `/api/clients/:id` | Update client |
| DELETE | `/api/clients/:id` | Delete client |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List templates |
| POST | `/api/templates` | Create template |
| POST | `/api/templates/:id/render` | Render template |
| GET | `/api/templates/signatures/list` | List signatures |
| POST | `/api/templates/signatures` | Create signature |

## Scripts

```bash
# Development
npm run dev                  # Start development server with hot reload
npm run build                # Build TypeScript to JavaScript
npm run start                # Start production server

# Database
npm run prisma:generate      # Generate Prisma client
npm run prisma:migrate       # Run database migrations
npm run prisma:studio        # Open Prisma Studio

# Code Quality
npm run lint                 # Run ESLint for code quality
npm run lint:fix             # Auto-fix linting issues
npm run format               # Format code with Prettier
npm run format:check         # Check code formatting
npm run type-check           # TypeScript type checking

# Testing
npm run test                 # Run tests
```

## Docker

```bash
# Start infrastructure services
docker-compose up -d postgres redis elasticsearch

# Run migrations
npm run prisma:migrate

# Start application
npm run dev
```

## Migration from Python Backend

This is a complete rewrite of the Python/FastAPI backend with:
- Same API endpoints and response formats
- Same database schema (via Prisma)
- Same business logic and algorithms
- Same security measures

The Streamlit test UI should work with both backends.

## License

MIT
