# Payroll

Status: **planned**

Legacy source(s): none

Domain endpoints for this module are mounted at `/api/payroll` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/payroll` - List payroll records
- `POST /api/payroll` - Create payroll record
- `PUT /api/payroll/:id` - Update payroll record
- `DELETE /api/payroll/:id` - Remove payroll record

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
