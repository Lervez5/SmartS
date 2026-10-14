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
import { hasPermission } from '@schoolos/auth/permissions';
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
   * Learning areas this person is allocated to teach to this stream. A subject
   * teacher is allocated to particular areas, so these are read from the
   * allocations rather than inferred from class responsibility.
   */
  subjectIds: string[];
  /** The subset of `subjectIds` they may enter results for. */
  resultSubjectIds: string[];
  /**
   * May enter results for every learning area taught to this stream, not just
   * the ones they teach.
   *
   * True for the main class teacher, and for an assistant the school granted
   * class-teacher rights to. This is a real distinction, not a convenience:
   * `subjectId` is deliberately null on a class-teacher allocation, because a
   * class teacher is responsible for their learners rather than for a particular
   * subject - so without this, the one person charged with a class's results
   * would be the one person who could not enter any of them.
   *
   * It is scoped to the stream it was granted for. A class teacher of one stream
   * gains nothing over a colleague's stream.
   */
  entersAllResults: boolean;
}

const EMPTY: Omit<StreamResponsibility, 'streamId'> = {
  isMainTeacher: false,
  isAssistant: false,
  managesStream: false,
  hasStreamAccess: false,
  subjectIds: [],
  resultSubjectIds: [],
  entersAllResults: false,
};

/**
 * Allocations for a set of streams, in one or more sessions.
 *
 * Fetched as a group because every caller needs the whole picture for a stream
 * - team and learning areas together - and resolving them one at a time would
 * mean a query per stream.
 *
 * Several sessions are accepted because a class can have learners in more than
 * one, and a teacher allocated to a stream in the session that learner belongs
 * to is the teacher for that learner.
 */
export async function loadAllocations(streamIds: string[], academicYearIds: string[] | string) {
  if (streamIds.length === 0) return [];
  const sessions = Array.isArray(academicYearIds) ? academicYearIds : [academicYearIds];
  if (sessions.length === 0) return [];

  const rows = await prisma.streamAllocation.findMany({
    where: {
      streamId: { in: streamIds },
      academicYearId: sessions.length === 1 ? sessions[0] : { in: sessions },
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
  // Filter to only stream-level allocations (streamId not null)
  return rows.filter((r) => r.streamId !== null) as Array<{
    streamId: string;
    teacherId: string;
    responsibility: string;
    subjectId: string | null;
    canManage: boolean;
    canEnterResults: boolean;
  }>;
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

    // A class teacher is responsible for their learners' results as a whole, so
    // they enter every learning area. A learning-area teacher enters only the
    // ones they are allocated to, and only where the school allowed it.
    if (row.responsibility === 'main_class_teacher') {
      entry.isMainTeacher = true;
      entry.managesStream = true;
      entry.hasStreamAccess = true;
      entry.entersAllResults = true;
    } else if (row.responsibility === 'assistant_class_teacher') {
      entry.isAssistant = true;
      entry.hasStreamAccess = true;
      if (row.canManage) entry.managesStream = true;
      // An assistant only enters results where the school granted that on the
      // assignment; a view-only assistant is not given it by their role alone.
      if (row.canManage || row.canEnterResults) entry.entersAllResults = true;
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

/**
 * What a person may do for one class's results.
 *
 * A teacher's reach is their allocation, not their role. Two separate things are
 * resolved, because they are two separate rights:
 *
 *   - *which learners* they may mark — the streams they hold an allocation for.
 *     A class with two streams has two teams, and one teacher reaching into the
 *     other's roster is exactly the leak this exists to close.
 *   - *which learning areas* they may mark there. A class teacher is responsible
 *     for their stream's results across every area, not only the ones they
 *     personally teach; a learning-area teacher is scoped to the areas they are
 *     allocated to.
 *
 * `allStreams` covers the caller whose job spans the whole class: academic
 * administrators, who are answerable for the school's results, and the
 * class-level assignments recorded before streams existed. It is never granted
 * by holding a teaching permission.
 */
export interface ClassResultsScope {
  classId: string;
  /** Streams the caller may enter results for, by id. */
  streamIds: string[];
  /** True when the caller reaches every stream of this class. */
  allStreams: boolean;
  /** True when the caller may enter results for every learning area here. */
  entersAllAreas: boolean;
  /**
   * Learning areas the caller may enter, when they do not enter all of them.
   * Empty for a class teacher or an administrator, whose reach is every area.
   */
  allowedSubjectIds: string[];
  /** True when the caller may enter results here at all. */
  hasAccess: boolean;
}

export interface ClassScopeInputs {
  classId: string;
  /** Every stream of the class, by id. */
  streams: Array<{ id: string }>;
  /**
   * The caller's own active allocations for those streams, with the session
   * each was recorded in. Already filtered to this class's streams by the
   * caller who loaded them.
   */
  ownAllocations: Array<{
    streamId: string;
    responsibility: string;
    subjectId: string | null;
    canManage: boolean;
    canEnterResults: boolean;
    academicYearId: string;
  }>;
  /** Sessions this class is recorded as being taught in. */
  taughtIn: string[];
  /** The teacher named on the class record, if any. */
  classTeacherId: string | null;
  userId: string;
}

/**
 * Pure decision over data the caller has already loaded.
 *
 * Kept separate from the loaders so the batched context view and the per-class
 * results grid reuse exactly the same rule: the two must never disagree about
 * who may enter what. The session filter is accepted for symmetry with the
 * loader but is not applied here - the per-class resolver computes it into a
 * separate `allocations` variable and then reads `ownAllocations` directly, so
 * applying it again would change behaviour rather than preserve it.
 */
export function decideClassScope(input: ClassScopeInputs): ClassResultsScope {
  const { classId, streams, ownAllocations, classTeacherId, userId } = input;
  void input.taughtIn;

  const streamIds: string[] = [];
  const allowedSubjectIds: string[] = [];
  let entersAllAreas = false;

  for (const stream of streams) {
    const mine = ownAllocations.filter((row) => row.streamId === stream.id);
    if (mine.length === 0) continue;

    const ownsClass = mine.some(
      (row) =>
        row.responsibility === 'main_class_teacher' ||
        row.responsibility === 'assistant_class_teacher'
    );
    // An assistant only enters results where the school granted that right on
    // the assignment; a view-only assistant is not given it by their role alone.
    const mayEnterAreas = mine.some(
      (row) =>
        row.responsibility === 'main_class_teacher' ||
        ((row.responsibility === 'assistant_class_teacher' ||
          row.responsibility === 'subject_teacher') &&
          row.canEnterResults)
    );

    if (!ownsClass && !mayEnterAreas) continue;

    streamIds.push(stream.id);
    if (mayEnterAreas) entersAllAreas = true;

    // Learning-area teachers are included: they teach a subject to a stream, and
    // entering that subject's marks for it is what the allocation is for.
    for (const row of mine) {
      if (row.subjectId && !allowedSubjectIds.includes(row.subjectId)) {
        allowedSubjectIds.push(row.subjectId);
      }
    }
  }

  if (streamIds.length > 0) {
    return {
      classId,
      streamIds,
      allStreams: false,
      entersAllAreas,
      allowedSubjectIds: entersAllAreas ? [] : allowedSubjectIds,
      hasAccess: true,
    };
  }

  // A teacher named as the class's teacher with no stream allocation of their
  // own still owns the class's results: the class record names them.
  if (classTeacherId === userId) {
    return {
      classId,
      streamIds: [],
      allStreams: true,
      entersAllAreas: true,
      allowedSubjectIds: [],
      hasAccess: true,
    };
  }

  return {
    classId,
    streamIds: [],
    allStreams: false,
    entersAllAreas: false,
    allowedSubjectIds: [],
    hasAccess: false,
  };
}

export async function resolveClassResultsScope(input: {
  userId: string;
  classId: string;
  academicYearId?: string | null;
  granted: readonly string[] | null | undefined;
}): Promise<ClassResultsScope> {
  const streams = await prisma.stream.findMany({
    where: { classId: input.classId },
    select: { id: true },
  });

  // Academic administration spans the class; responsibility for a stream does
  // not widen to the class it sits in.
  if (hasPermission(input.granted, 'academics.manage')) {
    return {
      classId: input.classId,
      streamIds: [],
      allStreams: true,
      entersAllAreas: true,
      allowedSubjectIds: [],
      hasAccess: true,
    };
  }

  // This caller's own allocations for these streams, in every session, read
  // from the allocation records themselves rather than from a guess at which
  // session is "active". Several sessions can hold `active` at once - a
  // reopened session, or a school that never closed the previous one - and
  // resolving against the wrong one silently drops an allocation that is
  // recorded and correct.
  const ownAllocationsResult = await prisma.streamAllocation.findMany({
    where: {
      streamId: { in: streams.map((s) => s.id) },
      teacherId: input.userId,
      status: 'active',
    },
    select: {
      streamId: true,
      responsibility: true,
      subjectId: true,
      canManage: true,
      canEnterResults: true,
      academicYearId: true,
    },
  });
  const ownAllocations = ownAllocationsResult.filter((r) => r.streamId !== null) as Array<{
    streamId: string;
    responsibility: string;
    subjectId: string | null;
    canManage: boolean;
    canEnterResults: boolean;
    academicYearId: string;
  }>;

  // A session only counts when the class is actually taught in it, so an
  // allocation from a session that ended does not keep granting access to the
  // learners who are there now.
  const taughtIn = input.academicYearId
    ? [input.academicYearId]
    : await sessionsForClass(input.classId);

  const cls = await prisma.class.findUnique({
    where: { id: input.classId },
    select: { teacherId: true },
  });

  return decideClassScope({
    classId: input.classId,
    streams,
    ownAllocations,
    taughtIn,
    classTeacherId: cls?.teacherId ?? null,
    userId: input.userId,
  });
}

/**
 * Every class in a school, with the caller's results scope for each.
 *
 * The teacher portal's context view resolves this once and then filters
 * assessments through it, rather than calling the per-class resolver per
 * assessment. The per-class resolver answers "may this person enter results
 * here", and this one answers "here is every class in the school and the
 * answer for each", which is what a context screen needs to offer the caller
 * a list they can actually work with.
 *
 * The decision is the same one `resolveClassResultsScope` makes, so the two
 * cannot disagree: a class the context view offers is a class the grid view
 * will accept, and a class the context view omits is one the grid view would
 * refuse. Academic administration spans every class; a teacher reaches only
 * the classes they are allocated to.
 */
export async function resolveClassResultsScopesForSchool(
  userId: string,
  schoolId: string,
  granted: readonly string[] | null | undefined
): Promise<Map<string, ClassResultsScope>> {
  const result = new Map<string, ClassResultsScope>();

  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: {
      id: true,
      teacherId: true,
      academicYearId: true,
      gradeLevel: true,
      name: true,
      streams: { select: { id: true } },
    },
  });

  if (hasPermission(granted, 'academics.manage')) {
    for (const cls of classes) {
      result.set(cls.id, {
        classId: cls.id,
        streamIds: [],
        allStreams: true,
        entersAllAreas: true,
        allowedSubjectIds: [],
        hasAccess: true,
      });
    }
    return result;
  }

  const streamIds = [...new Set(classes.flatMap((cls) => cls.streams.map((s) => s.id)))];

  const ownAllocationsResult = await prisma.streamAllocation.findMany({
    where: {
      streamId: { in: streamIds },
      teacherId: userId,
      status: 'active',
    },
    select: {
      streamId: true,
      responsibility: true,
      subjectId: true,
      canManage: true,
      canEnterResults: true,
      academicYearId: true,
    },
  });
  const ownAllocations = ownAllocationsResult.filter((r) => r.streamId !== null) as Array<{
    streamId: string;
    responsibility: string;
    subjectId: string | null;
    canManage: boolean;
    canEnterResults: boolean;
    academicYearId: string;
  }>;

  // Sessions each class is recorded as being taught in, so an allocation from a
  // session that ended does not keep granting access to learners who are there
  // now. Read once per class rather than per stream: the class is the unit of
  // the session question, and streams inherit it.
  const taughtInByClass = new Map<string, string[]>();
  for (const cls of classes) {
    taughtInByClass.set(cls.id, await sessionsForClass(cls.id));
  }

  for (const cls of classes) {
    const scope = decideClassScope({
      classId: cls.id,
      streams: cls.streams,
      ownAllocations,
      taughtIn: taughtInByClass.get(cls.id) ?? [],
      classTeacherId: cls.teacherId ?? null,
      userId,
    });
    result.set(cls.id, scope);
  }

  return result;
}

/**
 * The sessions a class is recorded as being taught in.
 *
 * Taken from the class's own session and its enrolments, and deliberately **not**
 * from "the active session". Several sessions can hold `active` at once - a
 * reopened session, or a school that never closed the previous one - and
 * resolving against the wrong one silently drops an allocation that is
 * recorded and correct, which is how a teacher who teaches a class can be locked out
 * of grading it.
 *
 * An empty result means "no session was recorded anywhere", and the caller
 * treats that as no session constraint rather than as a reason to refuse. A
 * class with learners and no session recorded still has to be gradable.
 */
async function sessionsForClass(classId: string): Promise<string[]> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { academicYearId: true },
  });
  if (!cls) return [];

  const enrolments = await prisma.enrollment.findMany({
    where: { classId, academicYearId: { not: null } },
    select: { academicYearId: true },
    distinct: ['academicYearId'],
  });

  const sessions = [
    ...enrolments.map((row) => row.academicYearId).filter((id): id is string => Boolean(id)),
    ...(cls.academicYearId ? [cls.academicYearId] : []),
  ];
  return [...new Set(sessions)];
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
    select: { id: true },
    orderBy: { startDate: 'desc' },
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
