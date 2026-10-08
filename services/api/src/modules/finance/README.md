# Finance

Status: **migrated**

Legacy source(s): modules/payments, modules/subscriptions

Domain endpoints for this module are mounted at `/api/finance` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/finance` - Finance configuration
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment

## Notes

- School-scoped settings under `/api/settings/finance`
- Finance staff can manage invoices and payments

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
