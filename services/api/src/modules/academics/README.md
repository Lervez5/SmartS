# Academics

Status: **migrated**

Legacy source(s): modules/subjects, modules/courses, modules/timetable

Domain endpoints for this module are mounted at `/api/academics` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/academics` - Academic configuration
- `GET /api/academic-sessions` - List academic sessions
- `POST /api/academic-sessions` - Create session
- `PATCH /api/academic-sessions/:id` - Update session
- `GET /api/academic-sessions/current` - Current active session

## Notes

- Academic session selector in navbar reads from `/api/academic-sessions`
- Session status is derived: active session is Active, others Archived

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
