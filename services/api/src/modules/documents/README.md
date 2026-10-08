# Documents

Status: **migrated**

Legacy source(s): modules/upload

Domain endpoints for this module are mounted at `/api/documents` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## Key Endpoints

- `GET /api/documents` - List documents
- `POST /api/documents` - Upload document
- `GET /api/documents/:id` - Document detail
- `DELETE /api/documents/:id` - Remove document

## Notes

- Uploads mounted at `/api/uploads` before auth
- Documents are school-scoped

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
