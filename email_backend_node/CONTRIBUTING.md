# Contributing to Email Backend

Thank you for your interest in contributing to this project! This guide will help you get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Standards](#code-standards)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Common Tasks](#common-tasks)

## Development Setup

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- Redis
- Docker (optional, for running services)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd email_backend_node
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start infrastructure services** (using Docker)
   ```bash
   docker-compose up -d postgres redis elasticsearch
   ```

5. **Run database migrations**
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

### Verifying Setup

```bash
# Check health endpoint
curl http://localhost:3001/health

# Open Prisma Studio to view database
npm run prisma:studio
```

## Code Standards

### TypeScript Guidelines

- **Use TypeScript strict mode** - All code must pass type checking
- **Explicit return types** - Define return types for all functions
- **No `any` types** - Use proper typing or `unknown` with type guards
- **Prefer interfaces** over types for object shapes
- **Use const assertions** for literal types

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `email-sync.service.ts`)
- **Classes/Interfaces**: `PascalCase` (e.g., `EmailService`, `GraphMessage`)
- **Functions/Variables**: `camelCase` (e.g., `sendEmail`, `userId`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)
- **Private members**: prefix with `_` (e.g., `_internalMethod`)

### Code Formatting

We use **Prettier** for code formatting:

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

**Prettier Configuration** (.prettierrc):
- Semi-colons: Yes
- Single quotes: Yes
- Print width: 100
- Tab width: 4 spaces
- Trailing commas: ES5

### Linting

We use **ESLint** for code quality:

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

**Critical Rules**:
- ❌ **No `console.log`** - Use the centralized logger instead
- ❌ **No floating promises** - Always await or handle promises
- ❌ **No unused variables** - Remove or prefix with `_`
- ✅ **Use const** - Prefer `const` over `let`
- ✅ **Curly braces** - Always use braces for control structures

### Logging

**Always use the centralized logger, never console.log**:

```typescript
import { createLogger } from '@/utils/logger';

const logger = createLogger('ServiceName');

// Good ✅
logger.info('User logged in', { userId: user.id });
logger.error('Failed to send email', error, { emailId });

// Bad ❌
console.log('User logged in', user.id);
console.error('Failed to send email', error);
```

### Error Handling

Use typed exceptions from `utils/exceptions.ts`:

```typescript
import { NotFoundError, ValidationError } from '@/utils/exceptions';

// Good ✅
if (!user) {
    throw new NotFoundError('User', userId);
}

if (!email.isValid) {
    throw new ValidationError('Invalid email format');
}

// Bad ❌
if (!user) {
    throw new Error('User not found');
}
```

### Comments and Documentation

- Write **JSDoc** comments for all public APIs
- Explain **WHY**, not WHAT (code should be self-documenting)
- Use `//` for inline comments
- Use section headers with `// ===` separators

Example:

```typescript
/**
 * Syncs emails from Microsoft Graph API
 * @param userId - The user ID to sync emails for
 * @param options - Sync options including fullSync flag
 * @returns Sync results with counts
 * @throws {GraphApiError} When Graph API request fails
 * @throws {EmailSyncError} When email processing fails
 */
export async function syncEmails(
    userId: string,
    options: SyncOptions = {}
): Promise<SyncResult> {
    // Implementation
}
```

## Project Structure

```
src/
├── app.ts              # Express app setup
├── config/             # Configuration & DB clients
│   ├── index.ts        # Environment config with Zod
│   ├── database.ts     # Prisma client
│   ├── redis.ts        # Redis client
│   └── elasticsearch.ts
├── middleware/         # Express middleware
│   ├── auth.ts         # JWT & RBAC
│   ├── errorHandler.ts # Error handling
│   ├── rateLimiter.ts  # Rate limiting
│   └── logger.ts       # Request logging
├── routes/             # API endpoints
│   ├── index.ts        # Route aggregation
│   ├── auth.routes.ts
│   ├── emails.routes.ts
│   └── ...
├── services/           # Business logic
│   ├── index.ts
│   ├── email.service.ts
│   ├── threading.service.ts
│   └── ...
├── utils/              # Shared utilities
│   ├── exceptions.ts   # Custom error classes
│   ├── encryption.ts   # Token encryption
│   ├── validators.ts   # Zod schemas
│   └── logger.ts       # Winston logger
├── types/              # TypeScript types
│   └── index.ts
└── workers/            # Background jobs
    └── email-sync.worker.ts
```

## Development Workflow

### Feature Development

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** following code standards

3. **Test your changes**
   ```bash
   npm run type-check
   npm run lint
   npm run test
   ```

4. **Commit with descriptive messages**
   ```bash
   git commit -m "feat: add email batch send functionality"
   ```

### Commit Message Format

Follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add email scheduling functionality
fix: resolve thread grouping edge case
docs: update API documentation for webhooks
refactor: extract email sync into separate service
```

## Testing Guidelines

### Unit Tests

Write unit tests for:
- Service functions with business logic
- Utility functions
- Complex algorithms (e.g., threading)

Example:

```typescript
describe('threading.service', () => {
    describe('normalizeSubject', () => {
        it('should remove RE: prefix', () => {
            expect(normalizeSubject('RE: Test')).toBe('test');
        });

        it('should remove multiple prefixes', () => {
            expect(normalizeSubject('RE: FWD: Test')).toBe('test');
        });
    });
});
```

### Integration Tests

Test routes with:
- Valid inputs
- Invalid inputs
- Error cases
- Authentication/authorization

### Manual Testing

Use the Streamlit test UI in the project root to manually test API endpoints.

## Pull Request Process

### Before Submitting

- [ ] Code passes type checking (`npm run type-check`)
- [ ] Code passes linting (`npm run lint`)
- [ ] All tests pass (`npm run test`)
- [ ] Code is formatted (`npm run format`)
- [ ] No console.log statements remain
- [ ] Documentation updated if needed

### PR Guidelines

1. **Keep PRs focused** - One feature or fix per PR
2. **Write detailed descriptions** - Explain what and why
3. **Link related issues** - Use "Closes #123" syntax
4. **Request reviews** - Tag relevant team members
5. **Respond to feedback** - Address all review comments

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How were these changes tested?

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or noted above)
```

## Common Tasks

### Adding a New API Endpoint

1. **Define route** in `src/routes/`
2. **Add validation schema** in `src/utils/validators.ts`
3. **Implement service** logic in `src/services/`
4. **Add types** in `src/types/index.ts`
5. **Document** in README.md if public API

### Adding a New Service

1. Create `src/services/your-service.service.ts`
2. Export from `src/services/index.ts`
3. Add logger: `const logger = createLogger('YourService');`
4. Define service interface
5. Write JSDoc for public functions

### Updating Database Schema

1. **Modify** `prisma/schema.prisma`
2. **Create migration**: `npm run prisma:migrate`
3. **Generate client**: `npm run prisma:generate`
4. **Update types** if needed

### Adding Environment Variables

1. Add to `src/config/index.ts` envSchema
2. Update `.env.example`
3. Document in README.md
4. Add to config object with proper typing

## Getting Help

- **Documentation**: Check README.md and ARCHITECTURE.md
- **Issues**: Search existing issues or create new ones
- **Discussions**: Use GitHub Discussions for questions

## Code of Conduct

- Be respectful and professional
- Provide constructive feedback
- Help others learn and grow
- Focus on the code, not the person

---

Happy coding! 🚀
