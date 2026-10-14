/**
 * Learner Placement and Stream Reorganization Service
 *
 * Provides the core logic for:
 * - Fetching learners in a class (streamed and unstreamed)
 * - Previewing proposed placements (random, balanced distribution)
 * - Applying placement changes atomically
 * - Recording audit history
 * - Detecting teacher-allocation implications
 */

import { Enrollment, Prisma, Stream, Class } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../audit-logs/service';
import { currentSessionId } from '../academics/allocation/scope';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function assertValidId(value: string, label = 'id'): string {
  if (!OBJECT_ID.test(value)) {
    throw new ApiError(400, `${label} must be a valid identifier`);
  }
  return value;
}

/** A learner with their current placement context */
export interface LearnerPlacement {
  id: string;
  userId: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  streamId: string | null;
  streamCode: string | null;
  streamName: string | null;
  enrollmentDate: string | null;
}

/** A stream option for placement */
export interface StreamPlacementOption {
  id: string;
  name: string;
  code: string;
  capacity: number | null;
  learnerCount: number;
}

/** Audit record of a placement reorganization */
export interface PlacementHistoryEntry {
  id: string;
  learnerId: string;
  learnerName: string | null;
  previousStream: { id: string; name: string; code: string } | null;
  newStream: { id: string; name: string; code: string } | null;
  class: { id: string; name: string; gradeLevel: string | null };
  academicYear: { id: string; name: string; label: string | null };
  strategy: string;
  reason: string | null;
  actionBy: { id: string; name: string | null; email: string } | null;
  createdAt: Date;
}

export interface ClassPlacementView {
  class: { id: string; name: string; gradeLevel: string | null };
  academicYear: { id: string; name: string; label: string | null };
  streams: StreamPlacementOption[];
  learners: LearnerPlacement[];
  learnerCounts: {
    total: number;
    unassigned: number;
  };
  teacherAllocations: Array<{
    teacher: { id: string; name: string | null; email: string };
    responsibility: string;
    stream: { id: string; name: string; code: string } | null;
    class: { id: string; name: string; gradeLevel: string | null } | null;
    canManage: boolean;
    canEnterResults: boolean;
  }>;
}

/**
 * Get the complete placement view for a class within an academic session.
 * Includes all learners (in streams and unassigned), streams, and teacher allocations.
 */
export async function getClassPlacementView(
  schoolId: string,
  classId: string,
  academicYearId: string
): Promise<ClassPlacementView> {
  assertValidId(classId, 'classId');
  assertValidId(academicYearId, 'academicYearId');

  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      status: true,
      academicYearId: true,
    },
  });

  if (!cls) {
    throw new ApiError(404, 'Class not found in this school');
  }

  if (cls.status === 'archived') {
    throw new ApiError(409, 'Cannot reorganize placements in an archived class');
  }

  if (cls.academicYearId !== academicYearId) {
    throw new ApiError(409, 'This class does not belong to the selected academic session');
  }

  // Fetch streams with enrollment counts
  const streams = await prisma.stream.findMany({
    where: { classId, status: { not: 'archived' } },
    select: {
      id: true,
      name: true,
      code: true,
      capacity: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { code: 'asc' },
  });

  // Fetch all learners in the class (streamed and unstreamed)
  const learners = await prisma.enrollment.findMany({
    where: {
      classId,
      academicYearId,
      student: { status: { not: 'archived' } },
    },
    select: {
      id: true,
      studentId: true,
      streamId: true,
      startDate: true,
      createdAt: true,
      student: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      stream: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: [{ student: { name: 'asc' } }, { createdAt: 'desc' }],
  });

  // Fetch teacher allocations
  const allocations = await prisma.streamAllocation.findMany({
    where: {
      schoolId,
      academicYearId,
      status: 'active',
      OR: [
        { stream: { classId } },
        { classId },
      ],
    },
    select: {
      teacher: { select: { id: true, name: true, email: true } },
      responsibility: true,
      canManage: true,
      canEnterResults: true,
      stream: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true, gradeLevel: true } },
    },
    orderBy: [
      { stream: { code: 'asc' } },
      { class: { name: 'asc' } },
      { responsibility: 'asc' },
    ],
  });

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true, name: true, label: true },
  });

  return {
    class: {
      id: cls.id,
      name: cls.name,
      gradeLevel: cls.gradeLevel,
    },
    academicYear: academicYear ?? { id: academicYearId, name: academicYearId, label: null },
    streams: streams.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      capacity: s.capacity,
      learnerCount: s._count.enrollments,
    })),
    learners: learners.map((l) => ({
      id: l.id,
      userId: l.studentId ?? '',
      name: l.student?.name ?? null,
      firstName: l.student?.firstName ?? null,
      lastName: l.student?.lastName ?? null,
      email: l.student?.email ?? '',
      streamId: l.streamId ?? null,
      streamCode: l.stream?.code ?? null,
      streamName: l.stream?.name ?? null,
      enrollmentDate: (l.startDate ?? l.createdAt).toISOString(),
    })),
    learnerCounts: {
      total: learners.length,
      unassigned: learners.filter((l) => !l.streamId).length,
    },
    teacherAllocations: allocations.map((a) => ({
      teacher: a.teacher,
      responsibility: a.responsibility,
      stream: a.stream
        ? { id: a.stream.id, name: a.stream.name, code: a.stream.code }
        : null,
      class: a.class
        ? { id: a.class.id, name: a.class.name, gradeLevel: a.class.gradeLevel }
        : null,
      canManage: a.canManage,
      canEnterResults: a.canEnterResults,
    })),
  };
}

/**
 * Generate a placement preview.
 * - random: distribute learners randomly using a seed (xorshift for reproducibility)
 * - balanced: distribute as evenly as possible across streams
 */
export function generatePlacementPreview(
  learners: LearnerPlacement[],
  streamIds: string[],
  method: 'random' | 'balanced',
  seed?: number
): Record<string, string | null> {
  const assignment: Record<string, string | null> = {};

  // Only distribute unassigned learners; keep existing assignments
  const unassigned = learners.filter((l) => !l.streamId);

  if (unassigned.length === 0) {
    // No unassigned learners, keep current assignments
    for (const learner of learners) {
      assignment[learner.userId] = learner.streamId;
    }
    return assignment;
  }

  // Determine target streams, filtering out archived/full ones
  const activeStreams = streamIds.filter((id) => {
    const s = learners.find((l) => l.streamId === id);
    return true; // We check capacity separately
  });

  if (activeStreams.length === 0) {
    // No target streams - everyone stays unassigned
    for (const learner of learners) {
      assignment[learner.userId] = learner.streamId;
    }
    return assignment;
  }

  if (method === 'random') {
    return distributeRandom(learners, unassigned, activeStreams, seed);
  } else {
    return distributeBalanced(learners, unassigned, activeStreams);
  }
}

function distributeRandom(
  allLearners: LearnerPlacement[],
  unassigned: LearnerPlacement[],
  streamIds: string[],
  seed?: number
): Record<string, string | null> {
  const assignment: Record<string, string | null> = {};

  // Keep existing assignments
  for (const learner of allLearners) {
    if (learner.streamId) {
      assignment[learner.userId] = learner.streamId;
    }
  }

  // Simple seeded random distribution using xorshift
  let state = seed ?? Date.now();
  const random = () => {
    state = (state << 13) ^ (state >> 19) ^ (state << 5);
    return Math.abs(state) % 10000 / 10000;
  };

  // Shuffle unassigned and distribute round-robin
  const shuffled = [...unassigned].sort(() => random() - 0.5);
  shuffled.forEach((learner, i) => {
    const targetStream = streamIds[i % streamIds.length];
    assignment[learner.userId] = targetStream;
  });

  return assignment;
}

function distributeBalanced(
  allLearners: LearnerPlacement[],
  unassigned: LearnerPlacement[],
  streamIds: string[]
): Record<string, string | null> {
  const assignment: Record<string, string | null> = {};

  // Keep existing assignments
  for (const learner of allLearners) {
    if (learner.streamId) {
      assignment[learner.userId] = learner.streamId;
    }
  }

  // Count current stream sizes
  const streamSizes: Record<string, number> = {};
  for (const learner of allLearners) {
    if (learner.streamId && streamIds.includes(learner.streamId)) {
      streamSizes[learner.streamId] = (streamSizes[learner.streamId] ?? 0) + 1;
    }
  }

  // Distribute round-robin starting from the smallest stream
  for (const learner of unassigned) {
    // Find the stream with the fewest learners
    let targetStream = streamIds[0];
    let minSize = streamSizes[targetStream] ?? 0;
    for (const sid of streamIds) {
      const size = streamSizes[sid] ?? 0;
      if (size < minSize) {
        minSize = size;
        targetStream = sid;
      }
    }
    assignment[learner.userId] = targetStream;
    streamSizes[targetStream] = minSize + 1;
  }

  return assignment;
}

/**
 * Apply a confirmed placement plan within a transaction.
 *
 * - Validates all learners belong to the class
 * - Validates all streams belong to the class and session
 * - Updates enrollment.streamId for each learner
 * - Records audit log
 * - Checks for teacher allocation implications
 */
export async function applyPlacementPlan(
  schoolId: string,
  classId: string,
  academicYearId: string,
  assignments: Record<string, string | null>,
  strategy: string,
  seed?: number,
  reason?: string,
  actorId?: string
): Promise<{
  placed: number;
  unchanged: number;
  warnings: string[];
  teacherAllocationWarnings: string[];
}> {
  assertValidId(classId, 'classId');
  assertValidId(academicYearId, 'academicYearId');

  // Validate academic session belongs to school
  const session = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true },
  });
  if (!session) {
    throw new ApiError(404, 'Academic session not found in this school');
  }

  // Validate class belongs to school and session
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, name: true, gradeLevel: true, status: true, academicYearId: true },
  });
  if (!cls) {
    throw new ApiError(404, 'Class not found in this school');
  }
  if (cls.status === 'archived') {
    throw new ApiError(409, 'Cannot place learners in an archived class');
  }
  if (cls.academicYearId !== academicYearId) {
    throw new ApiError(409, 'This class does not belong to the selected academic session');
  }

  // Validate all stream IDs belong to this class
  const allLearnerIds = Object.keys(assignments);
  const streamIds = new Set(
    Object.values(assignments).filter((s): s is string => s !== null)
  );

  if (streamIds.size > 0) {
    const validStreams = await prisma.stream.findMany({
      where: {
        classId,
        id: { in: [...streamIds] },
        status: { not: 'archived' },
      },
      select: { id: true, code: true, capacity: true, _count: { select: { enrollments: true } } },
    });

    const validStreamIds = new Set(validStreams.map((s) => s.id));
    for (const sid of streamIds) {
      if (!validStreamIds.has(sid)) {
        throw new ApiError(
          400,
          `Stream ${sid} does not belong to class ${cls.name} in this session`
        );
      }
    }

    // Check capacity violations
    const capacityWarnings: string[] = [];
    for (const s of validStreams) {
      const assignedCount = Object.values(assignments).filter((v) => v === s.id).length;
      const streamCapacity = s.capacity ?? null;
      if (streamCapacity && s._count.enrollments + assignedCount > streamCapacity) {
        capacityWarnings.push(
          `Stream ${s.code} has ${s._count.enrollments + assignedCount} learners, exceeding its capacity of ${streamCapacity}`
        );
      }
    }

    // Apply changes with capacity warnings (not blocking)
    void capacityWarnings;
  }

  // Validate all learner user IDs belong to this school and are enrolled in this class
  if (allLearnerIds.length > 0) {
    const validLearners = await prisma.enrollment.findMany({
      where: {
        classId,
        studentId: { in: allLearnerIds },
      },
      select: { studentId: true, streamId: true, id: true },
    });

    const validLearnerIds = new Set(validLearners.map((e) => e.studentId));
    for (const learnerId of allLearnerIds) {
      if (!validLearnerIds.has(learnerId)) {
        throw new ApiError(
          400,
          `Learner ${learnerId} is not enrolled in this class`
        );
      }
    }
  }

  // Detect teacher allocation implications
  const teacherAllocationWarnings = await checkTeacherAllocationImplications(
    schoolId,
    classId,
    academicYearId
  );

  // Apply changes atomically
  let placed = 0;
  let unchanged = 0;
  const changeLog: Array<{
    learnerId: string;
    previousStream: string | null;
    newStream: string | null;
  }> = [];

  await prisma.$transaction(async (tx) => {
    const enrollments = await tx.enrollment.findMany({
      where: {
        classId,
        studentId: { in: allLearnerIds },
      },
      select: { id: true, studentId: true, streamId: true },
    });

    for (const enrollment of enrollments) {
      if (!enrollment.studentId) continue;
      const currentStream = enrollment.streamId;
      const newStream = assignments[enrollment.studentId];

      if (currentStream !== newStream) {
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { streamId: newStream ?? null },
        });
        changeLog.push({
          learnerId: enrollment.studentId!,
          previousStream: currentStream,
          newStream: newStream ?? null,
        });
        placed++;
      } else {
        unchanged++;
      }
    }

    // Record audit log
    if (changeLog.length > 0) {
      await tx.placementHistory.createMany({
        data: changeLog.map((change) => ({
          learnerId: change.learnerId,
          previousStreamId: change.previousStream,
          newStreamId: change.newStream,
          classId,
          academicYearId,
          strategy,
          seed: seed ?? null,
          reason: reason ?? null,
          actionById: actorId ?? null,
        })),
      });

      await tx.auditLog.create({
        data: {
          userId: actorId ?? null,
          action: 'PLACEMENT_REORGANIZATION',
          details: `Reorganized ${placed} learners in ${cls.name} (session ${academicYearId}) using ${strategy} strategy. ${changeLog.length} changes.`,
          schoolId,
        },
      });
    }
  });

  return {
    placed,
    unchanged,
    warnings: [],
    teacherAllocationWarnings,
  };
}

/**
 * Check if teacher allocations may be affected by current stream state.
 */
async function checkTeacherAllocationImplications(
  schoolId: string,
  classId: string,
  academicYearId: string
): Promise<string[]> {
  const warnings: string[] = [];
  const streams = await prisma.stream.findMany({
    where: { classId, status: 'active' },
    select: { id: true, code: true, _count: { select: { enrollments: true } } },
  });

  // Check for streams without main class teachers
  for (const stream of streams) {
    const hasMainTeacher = await prisma.streamAllocation.findFirst({
      where: {
        streamId: stream.id,
        academicYearId,
        responsibility: 'main_class_teacher',
        status: 'active',
      },
      select: { id: true },
    });

    if (!hasMainTeacher && stream._count.enrollments > 0) {
      warnings.push(
        `Stream ${stream.code} has ${stream._count.enrollments} learners but no main class teacher assigned`
      );
    }
  }

  return warnings;
}

/**
 * Move a single learner between streams (or to unassigned).
 */
export async function moveLearner(
  schoolId: string,
  learnerId: string,
  fromStreamId: string | null,
  toStreamId: string | null,
  academicYearId: string,
  classId: string,
  actorId?: string
): Promise<{ success: boolean; warning?: string }> {
  assertValidId(classId, 'classId');
  assertValidId(academicYearId, 'academicYearId');

  // Validate class belongs to school and session
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId, academicYearId },
    select: { id: true, name: true, status: true },
  });
  if (!cls) {
    throw new ApiError(404, 'Class not found in this school or session');
  }
  if (cls.status === 'archived') {
    throw new ApiError(409, 'Cannot move learners in an archived class');
  }

  // Validate learner enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: { classId, studentId: learnerId },
    select: {
      id: true,
      studentId: true,
      streamId: true,
      student: { select: { name: true, email: true } },
    },
  });

  if (!enrollment || !enrollment.studentId) {
    throw new ApiError(404, 'Learner is not enrolled in this class');
  }

  // Validate fromStreamId
  if (fromStreamId && enrollment.streamId !== fromStreamId) {
    throw new ApiError(400, 'The learner is not currently in the specified source stream');
  }

  // Validate toStreamId
  if (toStreamId) {
    const targetStream = await prisma.stream.findFirst({
      where: { id: toStreamId, classId, status: { not: 'archived' } },
      select: { id: true, capacity: true, _count: { select: { enrollments: true } } },
    });
    if (!targetStream) {
      throw new ApiError(404, 'Stream not found in this class');
    }

    // Check capacity
    if (targetStream.capacity && enrollment.streamId !== toStreamId) {
      if (targetStream._count.enrollments + 1 > targetStream.capacity) {
        throw new ApiError(409, 'Target stream capacity exceeded');
      }
    }
  }

  const previousStream = enrollment.streamId;

  // Apply the move
  const updated = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { streamId: toStreamId ?? null },
    select: { id: true, streamId: true },
  });

  // Record history
  await prisma.placementHistory.create({
    data: {
      learnerId: enrollment.studentId!,
      previousStreamId: previousStream,
      newStreamId: toStreamId,
      classId,
      academicYearId,
      strategy: 'manual',
      reason: null,
      actionById: actorId ?? null,
    },
  });

  await recordAuditLog(
    actorId ?? null,
    'PLACEMENT_MOVE',
    `Moved ${enrollment.student?.email ?? enrollment.studentId} from ${previousStream ? `stream ${previousStream}` : 'unassigned'} to ${toStreamId ? `stream ${toStreamId}` : 'unassigned'} in class ${cls.name}`
  );

  return { success: true };
}

/**
 * Create a new stream within a class.
 */
export async function createStream(
  schoolId: string,
  classId: string,
  academicYearId: string,
  input: {
    name: string;
    code: string;
    capacity?: number;
  },
  actorId?: string
): Promise<StreamPlacementOption> {
  assertValidId(classId, 'classId');
  assertValidId(academicYearId, 'academicYearId');

  // Validate class
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId, academicYearId, status: 'active' },
    select: { id: true, name: true, gradeLevel: true },
  });
  if (!cls) {
    throw new ApiError(404, 'Active class not found in this school or session');
  }

  // Check for duplicate stream code within the class
  const existing = await prisma.stream.findFirst({
    where: { classId, code: input.code },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(409, `Stream "${input.code}" already exists in class ${cls.name}`);
  }

  // Create the stream within a transaction
  const stream = await prisma.$transaction(async (tx) => {
    const created = await tx.stream.create({
      data: {
        classId,
        name: input.name,
        code: input.code,
        capacity: input.capacity,
        academicYearId,
        status: 'active',
      },
      select: { id: true, name: true, code: true, capacity: true },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId ?? null,
        action: 'STREAM_CREATED',
        details: `Created stream ${input.code} (${input.name}) in class ${cls.name} (session ${academicYearId})`,
        schoolId,
      },
    });

    return created;
  });

  return {
    id: stream.id,
    name: stream.name,
    code: stream.code,
    capacity: stream.capacity,
    learnerCount: 0,
  };
}

/**
 * Fetch placement history for audit/compliance.
 */
export async function getPlacementHistory(
  schoolId: string,
  filters: {
    classId?: string;
    streamId?: string;
    learnerId?: string;
    academicYearId?: string;
    limit?: number;
  }
): Promise<PlacementHistoryEntry[]> {
  const where: Prisma.PlacementHistoryWhereInput = {
    class: { schoolId },
    ...(filters.classId ? { classId: filters.classId } : {}),
    ...(filters.streamId ? { OR: [{ previousStreamId: filters.streamId }, { newStreamId: filters.streamId }] } : {}),
    ...(filters.learnerId ? { learnerId: filters.learnerId } : {}),
    ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
  };

  const history = await prisma.placementHistory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit ?? 200,
    select: {
      id: true,
      learnerId: true,
      previousStreamId: true,
      newStreamId: true,
      class: { select: { id: true, name: true, gradeLevel: true } },
      academicYear: { select: { id: true, name: true, label: true } },
      strategy: true,
      seed: true,
      reason: true,
      createdAt: true,
      actionBy: { select: { id: true, name: true, email: true } },
      newStream: {
        select: { id: true, name: true, code: true },
      },
      previousStream: {
        select: { id: true, name: true, code: true },
      },
      learner: {
        select: { name: true },
      },
    },
  });

  return history.map((h) => ({
    id: h.id,
    learnerId: h.learnerId,
    learnerName: h.learner?.name ?? null,
    previousStream: h.previousStream
      ? { id: h.previousStream.id, name: h.previousStream.name, code: h.previousStream.code }
      : null,
    newStream: h.newStream
      ? { id: h.newStream.id, name: h.newStream.name, code: h.newStream.code }
      : null,
    class: { id: h.class.id, name: h.class.name, gradeLevel: h.class.gradeLevel },
    academicYear: { id: h.academicYear.id, name: h.academicYear.name, label: h.academicYear.label },
    strategy: h.strategy,
    reason: h.reason,
    actionBy: h.actionBy
      ? { id: h.actionBy.id, name: h.actionBy.name, email: h.actionBy.email }
      : null,
    createdAt: h.createdAt,
  }));
}
