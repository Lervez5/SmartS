# Communication

Status: **migrated**

Legacy source(s): modules/messages

Domain endpoints for this module are mounted at `/api/communication` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/communication` - List messages
- `POST /api/communication` - Send message

## Notes

- Messages rendered in portal dashboards
- Notification bell consumes unread count

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
