# Teachers

Status: **planned**

Legacy source(s): (User role + Class.teacher)

Domain endpoints for this module are mounted at `/api/teachers` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/teachers` - List teachers
- `POST /api/teachers` - Create teacher
- `GET /api/teachers/:id` - Teacher detail
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Remove teacher

## Notes

- Teacher portal settings page now wired to personal settings API

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
