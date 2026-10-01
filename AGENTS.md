<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## Common Commands

### Development

```bash
pnpm dev              # Start all services (API + 4 portals) concurrently
pnpm dev:api          # Start only the API server (port 4000)
pnpm dev:admin        # Start only the admin portal (port 3003)
pnpm dev:student      # Start only the student portal (port 3000)
pnpm dev:teacher      # Start only the teacher portal (port 3001)
pnpm dev:parent       # Start only the parent portal (port 3002)
```

### Testing

```bash
pnpm test:auth        # Run API auth tests (42 tests)
pnpm test:watch       # Run auth tests in watch mode
```

### Build & Verify

```bash
pnpm build            # Build all packages and apps
pnpm typecheck        # Type-check all packages and apps
pnpm lint             # Lint all packages and apps
pnpm verify           # Run format:check + lint + typecheck
```

### Database

```bash
pnpm db:push          # Push Prisma schema changes to database
pnpm db:generate      # Generate Prisma client
pnpm seed             # Seed the database with fixture data
```

### Requirements

- MongoDB running at `mongodb://localhost:27017` (with `?replicaSet=rs0` for transactions)
- `.env` file at repo root (copy from `.env.example`)
- pnpm 9+ and Node 20+

### Ports

| Service | Port |
| ------- | ---- |
| Admin   | 3000 |
| Student | 3001 |
| Teacher | 3002 |
| Parent  | 3003 |
| API     | 4000 |
