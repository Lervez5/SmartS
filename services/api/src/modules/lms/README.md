# Lms

Status: **migrated**

Legacy source(s): modules/courses, modules/assignments, modules/assignments/submission

Domain endpoints for this module are mounted at `/api/lms` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/lms` - LMS overview
- Course and assignment endpoints under `/api/courses` and `/api/assignments`

## Notes

- Shared LMS components in `packages/ui/src/components/lms`

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
