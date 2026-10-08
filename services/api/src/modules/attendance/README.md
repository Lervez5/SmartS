# Attendance

Status: **migrated**

Legacy source(s): modules/attendance

Domain endpoints for this module are mounted at `/api/attendance` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/attendance` - Attendance overview
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/attendance/registers` - Class registers
- `GET /api/attendance/registers/:classId` - Register detail

## Notes

- Attendance registers are school-scoped
- Teachers can mark attendance for assigned classes

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
