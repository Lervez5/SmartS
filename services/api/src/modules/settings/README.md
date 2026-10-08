# Settings

Status: **migrated**

Legacy source(s): modules/settings

Domain endpoints for this module are mounted at `/api/settings` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/settings` - All school settings
- `GET /api/settings/:area` - One settings area
- `PUT /api/settings/:area` - Update one area
- `GET /api/settings/branding` - Branding for shell
- `GET /api/settings/personal` - Own preferences
- `PUT /api/settings/personal` - Update own preferences

## Areas

general, branding, academic, finance, subscription, notifications, glow, security, personal

## Recent Changes

- Personal settings backed by `UserPersonalSettings` Prisma model
- Theme preference wired to `next-themes` via `setTheme()`
- Profile/security/preferences sections shared across all portals

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
