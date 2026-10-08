# Staff

Status: **migrated**

Legacy source(s): none

Domain endpoints for this module are mounted at `/api/staff` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/staff` - List staff
- `POST /api/staff` - Create staff record
- `GET /api/staff/:id` - Staff detail
- `PUT /api/staff/:id` - Update staff
- `DELETE /api/staff/:id` - Remove staff
- `GET /api/staff/:id/assignments` - Teaching assignments

## Notes

- Staff management and academic assignment vertical slice implemented
- Classes backend enhanced with full CRUD and audit logging

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
