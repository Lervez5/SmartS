# Examinations

Status: **planned**

Legacy source(s): none

Domain endpoints for this module are mounted at `/api/examinations` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/examinations` - List examinations
- `POST /api/examinations` - Create examination
- `PUT /api/examinations/:id` - Update examination
- `DELETE /api/examinations/:id` - Remove examination

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
