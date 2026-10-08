/**
 * Teaching-allocation scope resolution.
 *
 * This is the one place that answers "what may this person do for this stream".
 * Attendance, results entry and the teacher portal all resolve through it, so
 * they cannot disagree about who is responsible for a stream.
 *
 * The resolution follows the centralized model in the project: the caller must
 * hold the permission *and* hold an allocation that covers the resource. Being a
 * `TEACHER` grants nothing on its own, and holding a global permission never
 * implies responsibility for a particular stream. An assistant who is granted
 * class-teacher rights is granted them for the one stream they are assigned to,
 * not for every stream their colleagues teach.
 *
 * Responsibility is per stream because a class divided into streams has one
 * teaching team per stream. Falling back to the class is deliberate and is
 * explained where it happens.
 */

import { prisma } from '../../../infrastructure/database';
import { ApiError } from '../../../shared/logger';

export interface StreamResponsibility {
  streamId: string;
  /** Holds the `main_class_teacher` allocation for this stream. */
  isMainTeacher: boolean;
  /** Holds an `assistant_class_teacher` allocation for this stream. */
  isAssistant: boolean;
  /**
   * May act on the stream's learners: attendance, class activities,
   * communication. True for the main teacher, and for an assistant the school
   * granted `canManage` to.
   */
  managesStream: boolean;
  /** May see the stream at all. A view-only assistant has this without the above. */
  hasStreamAccess: boolean;
  /**
   * Learning areas this person is allocated to teach to this stream. A class
   * teacher is responsible for the learners but is not thereby the teacher of
   * every learning area, so these are read from the allocations rather than
   * inferred from class responsibility.
   */
  subjectIds: string[];
  /** The subset of `subjectIds` they may enter results for. */
  resultSubjectIds: string[];
}

const EMPTY: Omit<StreamResponsibility, 'streamId'> = {
  isMainTeacher: false,
  isAssistant: false,
  managesStream: false,
  hasStreamAccess: false,
  subjectIds: [],
  resultSubjectIds: [],
};

/**
 * Allocations for a set of streams in one session, in a single query.
 *
 * Fetched as a group because every caller needs the whole picture for a stream
 * - team and learning areas together - and resolving them one at a time would
 * mean a query per stream.
 */
export async function loadAllocations(streamIds: string[], academicYearId: string) {
  if (streamIds.length === 0) return [];
  return prisma.streamAllocation.findMany({
    where: {
      streamId: { in: streamIds },
      academicYearId,
      status: 'active',
    },
    select: {
      streamId: true,
      teacherId: true,
      responsibility: true,
      subjectId: true,
      canManage: true,
      canEnterResults: true,
    },
  });
}

/** Resolves one person's responsibility across many streams at once. */
export function summariseResponsibility(
  userId: string,
  allocations: Array<{
    streamId: string;
    teacherId: string;
    responsibility: string;
    subjectId: string | null;
    canManage: boolean;
    canEnterResults: boolean;
  }>,
  streamIds: string[]
): Map<string, StreamResponsibility> {
  const result = new Map<string, StreamResponsibility>(
    streamIds.map((id) => [id, { streamId: id, ...EMPTY }])
  );

  for (const row of allocations) {
    if (row.teacherId !== userId) continue;
    const entry = result.get(row.streamId);
    if (!entry) continue;

    if (row.responsibility === 'main_class_teacher') {
      entry.isMainTeacher = true;
      entry.managesStream = true;
      entry.hasStreamAccess = true;
    } else if (row.responsibility === 'assistant_class_teacher') {
      entry.isAssistant = true;
      entry.hasStreamAccess = true;
      if (row.canManage) entry.managesStream = true;
    } else if (row.responsibility === 'subject_teacher' && row.subjectId) {
      if (!entry.subjectIds.includes(row.subjectId)) entry.subjectIds.push(row.subjectId);
      if (row.canEnterResults && !entry.resultSubjectIds.includes(row.subjectId)) {
        entry.resultSubjectIds.push(row.subjectId);
      }
    }
  }

  return result;
}

/** Resolves responsibility for one stream in one session. */
export async function resolveStreamResponsibility(
  userId: string,
  streamId: string,
  academicYearId: string
): Promise<StreamResponsibility | null> {
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
    select: { id: true },
  });
  if (!stream) return null;

  const allocations = await loadAllocations([streamId], academicYearId);
  return summariseResponsibility(userId, allocations, [streamId]).get(streamId) ?? null;
}

/** The streams a person may manage, within one class and session. */
export async function manageableStreamIds(
  userId: string,
  classId: string,
  academicYearId: string
): Promise<string[]> {
  const streams = await prisma.stream.findMany({
    where: { classId },
    select: { id: true },
  });
  if (streams.length === 0) return [];

  const allocations = await loadAllocations(
    streams.map((s) => s.id),
    academicYearId
  );
  const summary = summariseResponsibility(
    userId,
    allocations,
    streams.map((s) => s.id)
  );

  return [...summary.values()].filter((r) => r.managesStream).map((r) => r.streamId);
}

/** The active academic session for a school, which allocations default to. */
export async function currentSessionId(schoolId: string): Promise<string | null> {
  const active = await prisma.academicYear.findFirst({
    where: { schoolId, status: 'active' },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });
  if (active) return active.id;

  // A school that has not opened a session yet still needs one to allocate
  // against, so the most recent session is offered rather than refusing.
  const latest = await prisma.academicYear.findFirst({
    where: { schoolId },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });
  return latest?.id ?? null;
}

/**
 * Confirms a session belongs to the school before an allocation is written to it.
 *
 * Session scope is authoritative, so this is checked rather than trusted from
 * the request body: an allocation for another school's session would resolve
 * responsibility in the wrong institution.
 */
export async function requireSessionOfSchool(
  academicYearId: string,
  schoolId: string
): Promise<string> {
  const session = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true },
  });
  if (!session) {
    throw new ApiError(404, 'Academic session not found in this school');
  }
  return session.id;
}
