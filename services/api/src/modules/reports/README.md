# Reports

Status: **migrated**

Legacy source(s): modules/reporting, modules/analytics

Domain endpoints for this module are mounted at `/api/reports` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/reports` - List reports
- `GET /api/reports/:id` - Report detail
- `GET /api/reports/:id/export` - Export report

## Notes

- Academic, attendance, finance reports available
- Export permissions enforced server-side

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
