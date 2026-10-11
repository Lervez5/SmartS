# Subjects

Status: **migrated**

Legacy source(s): modules/subjects

Domain endpoints for this module are mounted at `/api/subjects` by the
central router. Business logic lives in this module only (controllers,
services, repositories). Frontends must never implement domain logic or
database access directly.

## What this module is

`Subject` is the school's learning area. It is the record results, teacher
allocations, examinations, courses and grades all hang off, so this module is a
read path over that same catalogue rather than a catalogue of its own — the
Learning Areas workspace at `/api/learning-areas` is the write path and manages
these records.

## Key Endpoints

- `GET /api/subjects` - List subjects
- `GET /api/subjects/:id` - Detail a subject

Both require `learningAreas.view` and are scoped to the caller's school.

## Writes

There are deliberately **no** `POST`, `PUT` or `DELETE` routes here.

An earlier revision of this README documented them even though they had never
existed, which made the module look further along than it was. Creating,
editing, retiring and deleting a learning area needs grade applicability, the
custom-vs-curriculum origin, duplicate handling and a dependency check before a
delete — all of which the Learning Areas workspace applies. A second write path
here would let a learning area be created that bypassed them.

Use `/api/learning-areas` for those operations.

## Note on scoping

These routes previously answered with no permission guard and no `schoolId`
filter, which returned every school's catalogue to any authenticated user. Both
are now enforced, and an id from another school reads as `404`.

> State `migrated` = existing functionality carried over from the legacy
> backend. `planned` = not yet implemented in this pass; scaffolded and
> ready for subsequent implementation.
