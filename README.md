# School OS

A one-school School Operating System built on Turborepo + pnpm.

## Overview

School OS is a monorepo that bundles an Express / Prisma / MongoDB API with four
Next.js portals (Admin, Student, Teacher, Parent) and shared packages for
authentication, UI components, types, validation, and utilities.

## Project Structure

```bash
.
├── apps/
│   ├── admin/      # Admin portal (port 3003)
│   ├── student/    # Student portal  (port 3000)
│   ├── teacher/    # Teacher portal   (port 3001)
│   └── parent/     # Parent portal    (port 3002)
├── packages/
│   ├── auth/       # Auth hooks, RBAC permissions, navigation
│   ├── hooks/      # Shared React hooks (useApi, useAuth, etc.)
│   ├── ui/         # Design system components
│   ├── types/      # Shared TypeScript types
│   ├── validation/ # Shared Zod schemas
│   └── utils/      # Shared utilities
├── services/
│   └── api/        # API server (port 4000)
├── prisma/         # Prisma schema, migrations
└── turbo.json      # Turborepo pipeline configuration
```

## Prerequisites

- **pnpm 10+** (see `packageManager` in `package.json`)
- **Node.js 20+**
- **MongoDB** with replica set enabled:
  `mongodb://localhost:27017/?replicaSet=rs0`
- **Redis** (optional, for queues): `redis://localhost:6379`

### Initial Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env

# 3. Generate Prisma client
pnpm db:generate

# 4. Push schema to database
pnpm db:push

# 5. Seed the database (creates superuser admin@school.example)
pnpm seed
```

## Development

```bash
pnpm dev          # Start all services (API + 4 portals) concurrently
pnpm dev:api      # API server only (port 4000)
pnpm dev:admin    # Admin portal only (port 3003)
pnpm dev:student  # Student portal only (port 3000)
pnpm dev:teacher  # Teacher portal only (port 3001)
pnpm dev:parent   # Parent portal only (port 3002)
```

## Testing

```bash
pnpm test:auth    # Run API auth tests
pnpm test:watch   # Run auth tests in watch mode
```

Backend integration tests live in `services/api/tests/` and are run with Vitest
against a `schoolos_test` MongoDB database (see `services/api/vitest.config.ts`
for the configured `DATABASE_URL`).

## Build & Verify

```bash
pnpm build        # Build all packages and apps
pnpm typecheck    # Type-check all packages and apps
pnpm lint         # Lint all packages and apps
pnpm verify       # Run format:check + lint + typecheck
```

## Database

```bash
pnpm db:push      # Push Prisma schema changes to database
pnpm db:generate  # Generate Prisma client
pnpm db:validate  # Validate Prisma schema against database
pnpm seed         # Seed the database with fixture data
```

## Ports

| Service | Port |
| ------- | ---- |
| Admin   | 3003 |
| Student | 3000 |
| Teacher | 3001 |
| Parent  | 3002 |
| API     | 4000 |

## Architecture Notes

- **One School model** - the application is built for a single school. School-scoped
  data is keyed by `schoolId` on every tenant-aware model.
- **Identity separation** - a `User` is the authentication entity; domain profiles
  (`StudentProfile`, etc.) extend it with school-specific data.
- **RBAC** - permissions are string keys (`domain.action`) synced from
  `packages/auth/src/permissions.ts` into the database at startup. Roles are
  assigned permissions; users inherit permissions through role memberships.
- **API-first** - all business logic and data access lives in `services/api`. Frontend
  apps consume the REST API under `/api/*`.
