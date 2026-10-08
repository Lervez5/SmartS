# Library

Status: **planned**

Legacy source(s): none

Domain endpoints for this module are mounted at `/api/library` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/library` - List library items
- `POST /api/library` - Add library item
- `PUT /api/library/:id` - Update library item
- `DELETE /api/library/:id` - Remove library item

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
