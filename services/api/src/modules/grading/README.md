# Grading

Status: **planned**

Legacy source(s): none

Domain endpoints for this module are mounted at `/api/grading` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/grading` - List grading records
- `POST /api/grading` - Create grading record
- `PUT /api/grading/:id` - Update grading record
- `DELETE /api/grading/:id` - Remove grading record

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
