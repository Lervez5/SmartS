# Classes

Status: **migrated**

Legacy source(s): modules/classes

Domain endpoints for this module are mounted at `/api/classes` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/classes` - List classes
- `POST /api/classes` - Create class
- `GET /api/classes/:id` - Class detail
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Remove class

## Recent Changes

- Full CRUD with school-scoped listing
- Assignments and audit logging
- Admin portal Classes listing, detail, create, and stream creation pages

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
