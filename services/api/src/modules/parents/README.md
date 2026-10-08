# Parents

Status: **planned**

Legacy source(s): (parent-child link)

Domain endpoints for this module are mounted at `/api/parents` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/parents` - List parents
- `POST /api/parents` - Create parent
- `GET /api/parents/:id` - Parent detail
- `PUT /api/parents/:id` - Update parent
- `DELETE /api/parents/:id` - Remove parent

## Recent Changes

- Parent portal navbar now fetches academic session
- Added `academics.view` to `PARENT_GRANTS`

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
