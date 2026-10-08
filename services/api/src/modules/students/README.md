# Students

Status: **migrated**

Legacy source(s): modules/children

Domain endpoints for this module are mounted at `/api/students` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/students` - List learners
- `POST /api/students` - Enrol learner
- `GET /api/students/:id` - Learner detail
- `PUT /api/students/:id` - Update learner
- `DELETE /api/students/:id` - Remove learner

## Notes

- Learner profile is distinct from User identity
- Portal: Student, Parent, Teacher, Admin

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
