/**
 * Teaching allocation service.
 *
 * Allocation is the authoritative record of who is responsible for a stream in an
 * academic session. This module owns reading it, both directions of the
 * relationship, and the rules that keep it coherent:
 *
 *   - a stream has exactly one active main class teacher per session
 *   - assistants and learning-area teachers are unlimited
 *   - an allocation belongs to one school, one session and one stream, and a
 *     learning area allocation names exactly one learning area
 *   - ending an allocation records the end rather than deleting the row, so who
 *     was responsible on a past date stays answerable
 *
 * It never creates, deletes or changes an account. A teacher who does not yet
 * have one is provisioned through the existing invitation workflow, because
 * identity and teaching responsibility are separate concerns.
 */

import { prisma } from '../../../infrastructure/database';
import { recordAuditLog } from '../../audit-logs/service';
import { ApiError } from '../../../shared/logger';
import { requireSessionOfSchool } from './scope';

const teacherSelect = { id: true, name: true, email: true } as const;

const allocationInclude = {
  teacher: { select: teacherSelect },
  subject: { select: { id: true, name: true, code: true } },
  academicYear: { select: { id: true, name: true, label: true, status: true } },
  stream: {
    select: {
      id: true,
      name: true,
      code: true,
      class: { select: { id: true, name: true, gradeLevel: true } },
    },
  },
} as const;

export interface ListOptions {
  academicYearId?: string;
  classId?: string;
  streamId?: string;
  teacherId?: string;
  subjectId?: string;
  responsibility?: 'main_class_teacher' | 'assistant_class_teacher' | 'subject_teacher';
  status?: 'active' | 'inactive';
  search?: string;
  includeEnded?: boolean;
  limit?: number;
}

/** Lists allocations, always confined to one school. */
export async function listAllocations(schoolId: string, options: ListOptions) {
  const where = {
    schoolId,
    ...(options.academicYearId ? { academicYearId: options.academicYearId } : {}),
    ...(options.streamId ? { streamId: options.streamId } : {}),
    ...(options.teacherId ? { teacherId: options.teacherId } : {}),
    ...(options.subjectId ? { subjectId: options.subjectId } : {}),
    ...(options.responsibility ? { responsibility: options.responsibility } : {}),
    /*
     * An ended allocation stays in the database as history, so it is hidden
     * unless the caller asks to see it. The filter is on `status` rather than on
     * `effectiveTo` being null: Prisma's MongoDB connector strips null values on
     * write, so an open allocation has no `effectiveTo` key at all, and a
     * `where: { effectiveTo: null }` would not match it - it would report every
     * open allocation as already ended.
     */
    ...(options.status
      ? { status: options.status }
      : options.includeEnded
        ? {}
        : { status: 'active' as const }),
    // Classes are reached through the stream, which is what carries the school
    // scope, so the class filter narrows the stream's parent rather than
    // bypassing the stream entirely.
    ...(options.classId ? { stream: { classId: options.classId } } : {}),
    ...(options.search
      ? {
          OR: [
            { teacher: { name: { contains: options.search, mode: 'insensitive' as const } } },
            { teacher: { email: { contains: options.search, mode: 'insensitive' as const } } },
            { subject: { name: { contains: options.search, mode: 'insensitive' as const } } },
            { stream: { name: { contains: options.search, mode: 'insensitive' as const } } },
            {
              stream: {
                class: { name: { contains: options.search, mode: 'insensitive' as const } },
              },
            },
          ],
        }
      : {}),
  };

  const rows = await prisma.streamAllocation.findMany({
    where,
    include: allocationInclude,
    orderBy: [
      { stream: { class: { name: 'asc' } } },
      { stream: { code: 'asc' } },
      { responsibility: 'asc' },
      { teacher: { name: 'asc' } },
    ],
    ...(options.limit ? { take: options.limit } : {}),
  });

  const total = await prisma.streamAllocation.count({ where });

  return { allocations: rows.map(present), total };
}

function present(row: {
  id: string;
  status: string;
  responsibility: string;
  canManage: boolean;
  canEnterResults: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
  teacher: { id: string; name: string | null; email: string };
  subject: { id: string; name: string; code: string | null } | null;
  academicYear: { id: string; name: string; label: string | null; status: string };
  stream: {
    id: string;
    name: string;
    code: string;
    class: { id: string; name: string; gradeLevel: string | null };
  };
}) {
  return {
    id: row.id,
    responsibility: row.responsibility,
    status: row.status,
    canManage: row.canManage,
    canEnterResults: row.canEnterResults,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    teacher: row.teacher,
    subject: row.subject,
    academicSession: row.academicYear,
    stream: {
      id: row.stream.id,
      name: row.stream.name,
      code: row.stream.code,
      class: row.stream.class,
    },
  };
}

/**
 * The teaching team of every stream in a class, for one session.
 *
 * This is the "stream to team" direction: the main class teacher, the
 * assistants and the learning-area teachers, grouped so an administrator can see
 * who covers a stream and what is still unstaffed.
 */
export async function streamTeams(
  schoolId: string,
  academicYearId: string,
  classId?: string
) {
  const classes = await prisma.class.findMany({
    where: { schoolId, ...(classId ? { id: classId } : {}) },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      streams: {
        where: { status: 'active' },
        select: { id: true, name: true, code: true, _count: { select: { enrollments: true } } },
        orderBy: { code: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const streamIds = classes.flatMap((c) => c.streams.map((s) => s.id));
  if (streamIds.length === 0) {
    return classes.map((c) => ({ class: c, streams: [] }));
  }

  const allocations = await prisma.streamAllocation.findMany({
    where: { schoolId, academicYearId, streamId: { in: streamIds }, status: 'active' },
    include: allocationInclude,
    orderBy: [{ responsibility: 'asc' }, { teacher: { name: 'asc' } }],
  });

  const byStream = new Map<string, typeof allocations>();
  for (const row of allocations) {
    const list = byStream.get(row.streamId) ?? [];
    list.push(row);
    byStream.set(row.streamId, list);
  }

  return classes.map((cls) => ({
    class: { id: cls.id, name: cls.name, gradeLevel: cls.gradeLevel },
    streams: cls.streams.map((stream) => {
      const rows = byStream.get(stream.id) ?? [];
      return {
        id: stream.id,
        name: stream.name,
        code: stream.code,
        learnerCount: stream._count.enrollments,
        mainTeacher: rows.find((r) => r.responsibility === 'main_class_teacher') ?? null,
        assistantTeachers: rows.filter((r) => r.responsibility === 'assistant_class_teacher'),
        subjectTeachers: rows.filter((r) => r.responsibility === 'subject_teacher'),
      };
    }),
  }));
}

/** Everything one teacher is allocated, across streams, classes and learning areas. */
export async function teacherWorkload(schoolId: string, teacherId: string) {
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, schoolMemberships: { some: { schoolId } } },
    select: teacherSelect,
  });
  if (!teacher) throw new ApiError(404, 'Teacher not found in this school');

  const rows = await prisma.streamAllocation.findMany({
    where: { schoolId, teacherId, status: 'active' },
    include: allocationInclude,
    orderBy: [
      { stream: { class: { name: 'asc' } } },
      { stream: { code: 'asc' } },
      { responsibility: 'asc' },
    ],
  });

  return {
    teacher,
    assignments: rows.map(present),
    streamCount: new Set(rows.map((r) => r.streamId)).size,
    classCount: new Set(rows.map((r) => r.stream.class.id)).size,
    subjectCount: new Set(rows.filter((r) => r.subjectId).map((r) => r.subjectId)).size,
  };
}

/** Confirms a person is staff of this school, without touching their account. */
async function requireTeacherOfSchool(teacherId: string, schoolId: string) {
  const teacher = await prisma.user.findFirst({
    where: {
      id: teacherId,
      schoolMemberships: { some: { schoolId } },
      roleMemberships: { some: { role: { name: 'TEACHER' } } },
    },
    select: teacherSelect,
  });
  if (!teacher) {
    throw new ApiError(
      404,
      'That person is not a teacher of this school. A teaching allocation cannot create an account; provision one through the invitations workflow first.'
    );
  }
  return teacher;
}

export interface CreateInput {
  schoolId: string;
  academicYearId: string;
  streamId: string;
  teacherId: string;
  responsibility: 'main_class_teacher' | 'assistant_class_teacher' | 'subject_teacher';
  subjectId?: string;
  canManage?: boolean;
  canEnterResults?: boolean;
  effectiveFrom?: Date;
}

export async function createAllocation(input: CreateInput, actorId: string | null) {
  const { schoolId } = input;

  await requireSessionOfSchool(input.academicYearId, schoolId);

  const stream = await prisma.stream.findFirst({
    where: { id: input.streamId, class: { schoolId } },
    select: { id: true, name: true, code: true, class: { select: { name: true } } },
  });
  if (!stream) throw new ApiError(404, 'Stream not found in this school');

  const teacher = await requireTeacherOfSchool(input.teacherId, schoolId);

  if (input.responsibility === 'subject_teacher') {
    const subject = await prisma.subject.findFirst({
      where: { id: input.subjectId, schoolId },
      select: { id: true, name: true },
    });
    if (!subject) throw new ApiError(404, 'Learning area not found in this school');
  }

  /*
   * One main class teacher per stream per session. Checked here so the caller
   * gets a message that names the conflict, and relied upon at the database too
   * via a partial unique index, because two simultaneous requests would both
   * pass this check and only one could win.
   */
  if (input.responsibility === 'main_class_teacher') {
    const existing = await prisma.streamAllocation.findFirst({
      where: {
        streamId: input.streamId,
        academicYearId: input.academicYearId,
        responsibility: 'main_class_teacher',
        status: 'active',
      },
      include: { teacher: { select: teacherSelect } },
    });
    if (existing) {
      throw new ApiError(
        409,
        `${stream.class.name} ${stream.name} already has an active main class teacher for this session: ${existing.teacher.name ?? existing.teacher.email}. End that allocation before appointing another.`
      );
    }
  }

  // The same person cannot hold the same responsibility twice in one place.
  const duplicate = await prisma.streamAllocation.findFirst({
    where: {
      streamId: input.streamId,
      academicYearId: input.academicYearId,
      teacherId: input.teacherId,
      responsibility: input.responsibility,
      subjectId: input.subjectId ?? null,
      status: 'active',
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ApiError(409, 'That teacher already holds this allocation for this stream.');
  }

  const row = await prisma.streamAllocation.create({
    data: {
      schoolId,
      academicYearId: input.academicYearId,
      streamId: input.streamId,
      teacherId: input.teacherId,
      responsibility: input.responsibility,
      subjectId: input.responsibility === 'subject_teacher' ? input.subjectId : null,
      // The main teacher manages by definition; an assistant only if granted.
      canManage: input.responsibility === 'main_class_teacher' ? true : (input.canManage ?? false),
      canEnterResults: input.canEnterResults ?? true,
      effectiveFrom: input.effectiveFrom ?? new Date(),
    },
    include: allocationInclude,
  });

  const detail = [
    `Allocated ${teacher.name ?? teacher.email} as ${input.responsibility.replace(/_/g, ' ')}`,
    `for ${stream.class.name} ${stream.name} (${stream.code})`,
    input.subjectId ? `learning area ${row.subject?.name ?? input.subjectId}` : null,
    `session ${row.academicYear.label ?? row.academicYear.name}`,
  ]
    .filter(Boolean)
    .join(' ');

  await recordAuditLog(actorId, 'teaching.allocation.created', detail);

  return present(row);
}

export interface UpdateInput {
  canManage?: boolean;
  canEnterResults?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  status?: 'active' | 'inactive';
}

export async function updateAllocation(
  schoolId: string,
  id: string,
  input: UpdateInput,
  actorId: string | null
) {
  const existing = await prisma.streamAllocation.findFirst({
    where: { id, schoolId },
    include: allocationInclude,
  });
  if (!existing) throw new ApiError(404, 'Allocation not found');

  if (input.effectiveTo && input.effectiveTo < existing.effectiveFrom) {
    throw new ApiError(400, 'The end of the allocation cannot precede its start.');
  }

  // Reactivating an ended main-teacher row would collide with whoever holds it now.
  if (input.status === 'active' && existing.responsibility === 'main_class_teacher') {
    const holder = await prisma.streamAllocation.findFirst({
      where: {
        streamId: existing.streamId,
        academicYearId: existing.academicYearId,
        responsibility: 'main_class_teacher',
        status: 'active',
        id: { not: existing.id },
      },
      include: { teacher: { select: teacherSelect } },
    });
    if (holder) {
      throw new ApiError(
        409,
        `${existing.stream.class.name} ${existing.stream.name} already has an active main class teacher for this session: ${holder.teacher.name ?? holder.teacher.email}.`
      );
    }
  }

  const row = await prisma.streamAllocation.update({
    where: { id: existing.id },
    data: {
      ...(input.canManage !== undefined
        ? {
            // The main teacher manages the stream whether or not this is set, so
            // the flag is only recorded for an assistant.
            canManage:
              existing.responsibility === 'main_class_teacher' ? true : input.canManage,
          }
        : {}),
      ...(input.canEnterResults !== undefined ? { canEnterResults: input.canEnterResults } : {}),
      ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}),
      ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: allocationInclude,
  });

  await recordAuditLog(
    actorId,
    'teaching.allocation.updated',
    `Updated ${existing.teacher.name ?? existing.teacher.email} (${existing.responsibility.replace(/_/g, ' ')}) on ${existing.stream.class.name} ${existing.stream.name}: ${JSON.stringify(input)}`
  );

  return present(row);
}

/**
 * Ends an allocation.
 *
 * The row is kept and dated rather than deleted, so the answer to "who was
 * responsible for this stream on 3 March" survives a reassignment. Deleting it
 * would also silently remove a teacher's access without any record of the
 * change, which is exactly what an audit trail exists to prevent.
 */
export async function endAllocation(
  schoolId: string,
  id: string,
  endedAt: Date | undefined,
  actorId: string | null
) {
  const existing = await prisma.streamAllocation.findFirst({
    where: { id, schoolId },
    include: allocationInclude,
  });
  if (!existing) throw new ApiError(404, 'Allocation not found');
  if (existing.effectiveTo) {
    throw new ApiError(409, 'This allocation has already ended.');
  }

  const when = endedAt ?? new Date();

  const row = await prisma.streamAllocation.update({
    where: { id: existing.id },
    data: { status: 'inactive', effectiveTo: when },
    include: allocationInclude,
  });

  await recordAuditLog(
    actorId,
    'teaching.allocation.ended',
    `Ended ${existing.teacher.name ?? existing.teacher.email} (${existing.responsibility.replace(/_/g, ' ')}) on ${existing.stream.class.name} ${existing.stream.name}, effective ${when.toISOString()}`
  );

  return present(row);
}
