# Student Transitions

Status: **migrated**

The academic lifecycle of a learner: enrollments, class placements, exits, and
restores — all as a single timeline against one identity.

Domain endpoints for this module are mounted at `/api/student-transitions` by the
central router. Business logic lives in this module only (controllers, services,
repositories). Frontends must never implement domain logic or database access
directly.

## Key Endpoints

- `GET /api/student-transitions` - List transitions with filters (search, reason,
  academic session, date range, includeRestored) and sort options
- `GET /api/student-transitions/options` - Filter options (reasons with counts,
  academic years, classes)
- `GET /api/student-transitions/:id` - Transition detail with enrollment history
  and lifecycle timeline
- `POST /api/student-transitions` - Record an exit (archives the learner account)
- `PATCH /api/student-transitions/:id` - Update an unresolved exit
- `POST /api/student-transitions/:id/restore` - Restore a learner to the active
  roll (reactivates the account)

## Permissions

- `students.view` — list, detail, and options
- `students.manage` — record exit, update, restore

## Schema Changes

The `Enrollment` model gains two fields so each class placement can be
attributed to the session it happened in:

- `startDate` — when the learner joined the class (distinct from `createdAt`)
- `academicYearId` — foreign key to `AcademicYear`

## Notes

- An exit is a record against the learner's `StudentProfile`, not a second entity.
  Attendance, grades, documents, invoices, and parent links stay attached to the
  same profile.
- Exit reason and account status are distinct: the reason says why they left, the
  account state says whether the identity is still open.
- Write operations reuse `students.manage` rather than `alumni.manage`, so a DEAN
  can manage transitions from the Academics nav entry.
- Portal: Admin

> State `migrated` = existing functionality carried over from the legacy backend.
> `planned` = not yet implemented in this pass; scaffolded and ready for
> subsequent implementation.
