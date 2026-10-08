# Users

Status: **migrated**

Legacy source(s): modules/users

Domain endpoints for this module are mounted at `/api/users` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/me` - Update own profile
- `PUT /api/users/me/password` - Change own password
- `PUT /api/users/:id` - Admin update user
- `DELETE /api/users/:id` - Admin delete user

## Recent Changes

- `updateMeSchema` now accepts `phone`
- `updateMeService` persists and returns `phone`
- Profile updates refresh auth session via `setSession`

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
