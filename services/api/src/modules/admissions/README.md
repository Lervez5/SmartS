# Admissions

Status: **planned**

Legacy source(s): none

Domain endpoints for this module are mounted at `/api/admissions` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/admissions` - List admissions
- `POST /api/admissions` - Create admission
- `PUT /api/admissions/:id` - Update admission
- `DELETE /api/admissions/:id` - Remove admission

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
