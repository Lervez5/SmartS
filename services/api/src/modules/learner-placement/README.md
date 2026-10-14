# Learner Placement Module

This module provides the complete workflow for reorganizing learners into streams within a class for an academic session.

## Overview

The learner placement workflow enables administrators to:

1. **Create streams** for previously unstreamed classes
2. **Preview placements** using different distribution strategies
3. **Confirm placements** atomically with audit logging
4. **Move individual learners** between streams
5. **View placement history** for compliance and audit

## API Endpoints

### GET `/api/placement/:classId/:academicYearId`

Returns the complete placement view for a class in a session.

**Response:**

- `class` - class info (id, name, gradeLevel)
- `academicYear` - session info (id, name, label)
- `streams` - array of streams with learner counts and capacities
- `learners` - array of all learners (assigned and unassigned)
- `learnerCounts` - total and unassigned counts
- `teacherAllocations` - teacher assignments for this class/session

### POST `/api/placement/:classId/:academicYearId/preview`

Generates a placement preview.

**Body:**

```json
{
  "streamIds": ["stream-id-1", "stream-id-2"],
  "method": "balanced" | "random",
  "seed": 12345
}
```

**Response:** Preview with proposed stream assignments, capacity violations, and teacher warnings.

### POST `/api/placement/:classId/:academicYearId/apply`

Applies a confirmed placement plan.

**Body:**

```json
{
  "assignments": { "learner-id-1": "stream-id-1", "learner-id-2": null },
  "strategy": "balanced" | "random" | "manual",
  "seed": 12345,
  "reason": "Beginning of term reorganization"
}
```

**Response:**

```json
{
  "placed": 45,
  "unchanged": 12,
  "warnings": [],
  "teacherAllocationWarnings": ["Stream A has 30 learners but no main class teacher assigned"]
}
```

### POST `/api/placement/classes/:classId/streams`

Creates a new stream for reorganization.

**Body:**

```json
{
  "classId": "class-id",
  "academicYearId": "session-id",
  "name": "Stream A",
  "code": "A",
  "capacity": 40
}
```

### PATCH `/api/placement/streams/:streamId`

Updates a stream (rename, capacity, status).

### POST `/api/placement/streams/:streamId/archive`

Archives a stream (soft delete). Fails if stream has enrolled learners.

### POST `/api/placement/move`

Moves a single learner between streams.

**Body:**

```json
{
  "learnerId": "student-user-id",
  "fromStreamId": "stream-id" | null,
  "toStreamId": "stream-id" | null,
  "academicYearId": "session-id",
  "classId": "class-id"
}
```

### GET `/api/placement/history`

Fetches placement history with filters.

**Query params:**

- `classId`, `streamId`, `learnerId`, `academicYearId`, `limit`

### GET `/api/placement/impact/:classId/:academicYearId`

Previews the impact of creating N streams for an unstreamed class.

**Query param:** `proposedStreams=2`

## Distribution Strategies

### Balanced (Default)

Distributes learners as evenly as possible across streams. Considers existing enrollments to maintain balance.

### Random

Distributes learners randomly using a seeded xorshift algorithm for reproducibility. Same seed = same distribution.

## Teacher Allocation Warnings

The module checks for:

- Streams with learners but no main class teacher assigned
- Existing class-level allocations that may need stream-level reassignment

These are warnings, not blockers - the placement can proceed.

## Audit & Compliance

Every placement change creates:

1. `PlacementHistory` records - one per learner moved
2. `AuditLog` entry - summary of the reorganization

Fields captured:

- Learner, previous/new stream, class, session
- Strategy used, seed (for random), reason
- Action by (admin user), timestamp

## Data Preservation

- Enrollment records are updated in-place (streamId changed)
- No learner records are deleted or recreated
- Attendance, results, financial records remain linked to the enrollment
- Historical placement queries remain answerable via PlacementHistory

## Permissions

- `placements.view` - read placement views, previews, history
- `placements.manage` - create streams, apply placements, move learners

These are granted to `DEAN` and `SUPER_ADMIN` roles by default.
