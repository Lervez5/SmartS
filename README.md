# School OS

**School OS** is a serious, one-school School Operating System built as a monorepo
(Turborepo + pnpm workspaces). It consolidates the full lifecycle of a single
school - admissions, people, academics, attendance, learning, assessments,
finance, payroll, transport, library, inventory, communication and reporting -
behind role-based applications used by parents, students, teachers and
administrators.

> The current scope is intentionally a **single school**. Multi-tenancy, tenant
> routing and tenant databases are deliberately absent, but the persistence and
> domain layers are written so they can be extended later without a repository
> restructuring.

## Architectural rule

| Directory         | Purpose ("WHY/HOW")          | Contains                                                   |
| ----------------- | ---------------------------- | ---------------------------------------------------------- |
| `apps/`           | WHO uses the system          | Role-specific Next.js apps (parent/student/ teacher/admin) |
| `services/api/`   | WHAT the system does         | Central Node.js + Express + Prisma domain API              |
| `packages/`       | WHAT is shared               | UI, auth, types, validation, config, utils                 |
| `infrastructure/` | HOW the system runs          | Docker, nginx, backups, monitoring                         |
| `docs/`           | HOW the system is understood | Architecture, API, database, decisions                     |
| `scripts/`        | HOW the system is operated   | Setup, database, deployment automation                     |

- All application data flows through the central API. Frontends never touch the
  database directly and never duplicate domain business logic.
- Roles and domains are separate concepts: a user may hold one or more roles, and
  roles map to granular permissions (e.g. `students.read`, `attendance.write`,
  `finance.invoice`). The admin app is permission-driven.
- Currency is **KSH (Kenyan Shillings)**, stored in minor units (cents) everywhere.

## Repository layout

```bash
.
├── apps/
│   ├── student/       # Learner portal & LMS             (http://localhost:3000)
│   ├── parent/        # Guardian / Parent portal         (http://localhost:3001)
│   ├── teacher/       # Teaching staff portal            (http://localhost:3002)
│   └── admin/         # School administration portal     (http://localhost:3003)
├── services/
│   └── api/           # Central Node.js + Express + Prisma API (http://localhost:4000)
├── packages/
│   ├── ui/            # Shared, reusable React components
│   ├── auth/          # Shared auth client + JWT helpers
│   ├── types/         # Shared TypeScript types
│   ├── validation/    # Shared Zod validation schemas
│   ├── config/        # Shared runtime configuration (currency, roles, permissions)
│   └── utils/         # Shared pure utilities
├── infrastructure/
│   ├── docker/        # Dockerfiles for API + apps
│   ├── nginx/         # Reverse-proxy config (production subdomains)
│   ├── backups/       # Database / file backup jobs
│   └── monitoring/    # Prometheus / Grafana / health checks
├── docs/
│   ├── architecture/  # System architecture & diagrams
│   ├── api/           # API contracts (OpenAPI)
│   ├── database/      # Database design & migrations
│   └── decisions/     # ADRs (Architecture Decision Records)
├── scripts/
│   ├── setup/         # Dev environment bootstrap
│   ├── database/      # Migrations & seeding
│   └── deployment/    # Deploy scripts
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
└── .env.example
```

## Development topology

```bash
               http://localhost:4000/api
                      ┌────────────┐
                      │  API       │
                      │  (api)     │
                      └─────┬──────┘
            ┌──────────┼───────────┬───────────┐
        :3000        :3001      :3002        :3003
        parent      student     teacher      admin
```

Production can later map these to `parent.school-domain`, `student.school-domain`,
`teacher.school-domain`, `admin.school-domain` and `api.school-domain` behind the
nginx reverse proxy.

## Getting started

Requirements: Node.js >= 20, pnpm >= 9.

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# then edit .env if you need non-default ports / secrets

# 3. Start services (MongoDB replica set + Redis)
docker compose up -d mongodb redis

# 4. Generate the Prisma client + push the schema
pnpm --filter @schoolos/api prisma generate
pnpm --filter @schoolos/api prisma db push

# 5. Seed the first super-administrator
pnpm --filter @schoolos/api seed

# 6. Run everything in development
pnpm dev
#   - API      -> http://localhost:4000
#   - Parent    -> http://localhost:3000
#   - Student   -> http://localhost:3001
#   - Teacher   -> http://localhost:3002
#   - Admin     -> http://localhost:3003

# Alternatively, run all services (incl. MongoDB/Redis) via Docker:
docker compose up --build
```

## Commands

| Command           | Description                               |
| ----------------- | ----------------------------------------- |
| `pnpm install`    | Install all workspace dependencies        |
| `pnpm dev`        | Run API + all apps in development (Turbo) |
| `pnpm build`      | Type-check + build every project          |
| `pnpm typecheck`  | Type-check every project                  |
| `pnpm lint`       | Lint every project                        |
| `pnpm test`       | Run all tests                             |
| `pnpm run verify` | format:check + lint + typecheck           |

Per-project: `pnpm --filter <name> <script>`, e.g.
`pnpm --filter @schoolos/api dev`.

## Notes

- The persistence layer currently uses Prisma + MongoDB. Repositories isolate the
  domain layer from the database; see `docs/decisions/` for the MERN/MongoDB
  migration plan.
- See [`docs/architecture/`](docs/architecture/) for the full architecture and
  [`docs/Decisions/`](docs/decisions/) for architecture decisions.
