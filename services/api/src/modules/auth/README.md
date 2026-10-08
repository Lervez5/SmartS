# Auth

Status: **migrated**

Legacy source(s): security/auth.ts, security/rbac.ts, modules/auth, modules/invitations

Domain endpoints for this module are mounted at `/api/auth` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `GET /api/auth/me` - Current identity
- `POST /api/auth/refresh` - Renew access token
- `POST /api/auth/change-password` - Update own password
- `POST /api/auth/revoke-sessions` - Sign out everywhere

## Recent Changes

- Extended `AuthUser` with `phone` field
- Login/register services include `phone` in identity token
- Session revocation via `sessionTokenVersion` increment

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
