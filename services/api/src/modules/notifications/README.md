# Notifications

Status: **migrated**

Legacy source(s): modules/notifications

Domain endpoints for this module are mounted at `/api/notifications` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/notifications` - List notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark as read

## Notes

- Unread count consumed by navbar bell
- Notification preferences part of personal settings

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
