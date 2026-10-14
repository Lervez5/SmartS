/**
 * Learner Placement and Stream Reorganization API
 *
 * Routes for managing learner-placement workflows that do not change a
 * learner's identity, class, or academic session - only their stream within
 * a class for a session. Stream creation for reorganization is handled
 * through the existing /api/streams route; this module focuses on the
 * placement-preview, -apply, and -history flows.
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import {
  placementPreviewSchema,
  placementProposalSchema,
  confirmPlacementSchema,
  manualMoveSchema,
  placementHistoryQuerySchema,
  streamCreateSchema,
  streamUpdateSchema,
  type PlacementPreviewInput,
  type ConfirmPlacementInput,
} from './schema';
import {
  getClassPlacementView,
  generatePlacementPreview,
  applyPlacementPlan,
  moveLearner,
  createStream,
  getPlacementHistory,
} from './service';

export const router: Router = Router();

router.use(requireSchoolScope());

const requireView = requirePermissions('cohorts.view');
const requireManage = requirePermissions('cohorts.manage');

/**
 * GET /api/placement/:classId/:academicYearId
 * Returns the complete placement view for a class in a session.
 * Includes learners (assigned and unassigned), streams, and teacher allocations.
 */
router.get(
  '/:classId/:academicYearId',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { classId, academicYearId } = req.params;
    const view = await getClassPlacementView(schoolId, classId, academicYearId);
    res.json(view);
  })
);

/**
 * POST /api/placement/:classId/:academicYearId/preview
 * Generates a placement preview based on the specified strategy.
 */
router.post(
  '/:classId/:academicYearId/preview',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { classId, academicYearId } = req.params;
    const input: PlacementPreviewInput = placementPreviewSchema.parse(req.body);

    const view = await getClassPlacementView(schoolId, classId, academicYearId);

    // Validate that requested stream IDs belong to this class
    const streamIds = input.streamIds;
    const validStreamIds = view.streams.filter((s) => streamIds.includes(s.id)).map((s) => s.id);

    if (validStreamIds.length !== streamIds.length) {
      throw new ApiError(400, 'One or more specified streams do not belong to this class');
    }

    // Generate preview
    const assignments = generatePlacementPreview(
      view.learners,
      validStreamIds,
      input.method,
      input.seed
    );

    // Build the preview with detailed learner mapping
    const streamMap = new Map(view.streams.map((s) => [s.id, s]));

    const previewStreams = validStreamIds.map((streamId) => {
      const stream = streamMap.get(streamId)!;
      const learnersInStream = view.learners.filter((l) => assignments[l.userId] === streamId);
      return {
        id: stream.id,
        name: stream.name,
        code: stream.code,
        capacity: stream.capacity,
        currentCount: stream.learnerCount,
        proposedCount: learnersInStream.length,
        learners: learnersInStream,
        capacityExceeded:
          stream.capacity !== null &&
          stream.capacity !== undefined &&
          learnersInStream.length > stream.capacity,
      };
    });

    const unassignedLearners = view.learners.filter((l) => assignments[l.userId] === null);

    // Check for capacity violations across all streams
    const capacityViolations = previewStreams
      .filter((s) => s.capacityExceeded)
      .map(
        (s) =>
          `Stream ${s.code} would have ${s.proposedCount} learners, exceeding its capacity of ${s.capacity}`
      );

    const teacherWarnings = await checkTeacherAllocationWarnings(schoolId, classId, academicYearId);

    res.json({
      class: view.class,
      academicYear: view.academicYear,
      streams: previewStreams,
      unassigned: unassignedLearners,
      unassignedCount: unassignedLearners.length,
      totalLearners: view.learners.length,
      strategy: input.method,
      seed: input.seed ?? null,
      capacityViolations,
      teacherAllocationWarnings: teacherWarnings,
      // Summary stats
      summary: {
        totalStreams: validStreamIds.length,
        totalLearners: view.learners.length,
        assignedLearners: view.learners.length - unassignedLearners.length,
        unassignedLearners: unassignedLearners.length,
      },
    });
  })
);

/**
 * POST /api/placement/:classId/:academicYearId/apply
 * Apply a confirmed placement plan.
 */
router.post(
  '/:classId/:academicYearId/apply',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { classId, academicYearId } = req.params;
    const input: ConfirmPlacementInput = confirmPlacementSchema.parse(req.body);
    const actorId = req.user?.id ?? null;

    const result = await applyPlacementPlan(
      schoolId,
      classId,
      academicYearId,
      input.assignments,
      input.strategy,
      input.seed,
      input.reason,
      actorId ?? undefined
    );

    res.json(result);
  })
);

/**
 * POST /api/placement/classes/:classId/streams
 * Create a new stream for reorganization of an unstreamed class.
 */
router.post(
  '/classes/:classId/streams',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { classId } = req.params;
    const payload = streamCreateSchema.parse(req.body);
    const actorId = req.user?.id ?? null;

    if (payload.classId !== classId) {
      throw new ApiError(400, 'classId mismatch between URL and body');
    }

    const stream = await createStream(
      schoolId,
      classId,
      payload.academicYearId,
      {
        name: payload.name,
        code: payload.code,
        capacity: payload.capacity,
      },
      actorId ?? undefined
    );

    res.status(201).json({ stream });
  })
);

/**
 * PATCH /api/placement/streams/:streamId
 * Update a stream (rename, change capacity, archive).
 */
router.patch(
  '/streams/:streamId',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { streamId } = req.params;
    const payload = streamUpdateSchema.parse(req.body);

    const existing = await prisma.stream.findFirst({
      where: { id: streamId, class: { schoolId } },
      select: { id: true, classId: true, status: true, code: true, name: true },
    });
    if (!existing) {
      throw new ApiError(404, 'Stream not found in this school');
    }

    if (payload.status === 'archived' && existing.status !== 'archived') {
      const enrollmentCount = await prisma.enrollment.count({
        where: { streamId, classId: existing.classId },
      });
      if (enrollmentCount > 0) {
        throw new ApiError(
          409,
          `This stream has ${enrollmentCount} enrolled learner(s). Move them to another stream before archiving.`
        );
      }
    }

    const data: any = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.code !== undefined) {
      const clash = await prisma.stream.findFirst({
        where: {
          classId: existing.classId,
          code: payload.code,
          id: { not: streamId },
        },
        select: { id: true },
      });
      if (clash) {
        throw new ApiError(409, `That class already has a stream with the code "${payload.code}"`);
      }
      data.code = payload.code;
    }
    if (payload.capacity !== undefined) data.capacity = payload.capacity;
    if (payload.status !== undefined) data.status = payload.status;

    const updated = await prisma.stream.update({
      where: { id: streamId },
      data,
      include: { _count: { select: { enrollments: true } } },
    });

    res.json({ stream: presentStream(updated) });
  })
);

/**
 * POST /api/placement/streams/:streamId/archive
 * Archive a stream (soft-delete equivalent).
 */
router.post(
  '/streams/:streamId/archive',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { streamId } = req.params;

    const existing = await prisma.stream.findFirst({
      where: { id: streamId, class: { schoolId } },
      select: {
        id: true,
        status: true,
        classId: true,
        class: { select: { name: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!existing) {
      throw new ApiError(404, 'Stream not found in this school');
    }
    if (existing.status === 'archived') {
      throw new ApiError(409, 'This stream is already archived.');
    }
    if (existing._count.enrollments > 0) {
      throw new ApiError(
        409,
        `This stream has ${existing._count.enrollments} enrolled learner(s). Move them to another stream before archiving.`
      );
    }

    const stream = await prisma.stream.update({
      where: { id: streamId },
      data: { status: 'archived' },
      include: { _count: { select: { enrollments: true } } },
    });

    res.json({
      stream: presentStream(stream),
      retained: {
        learners: existing._count.enrollments,
        note: 'Enrolments, attendance and results are retained; the stream is retired, not deleted.',
      },
    });
  })
);

/**
 * POST /api/placement/move
 * Move a single learner between streams (or to/from unassigned).
 */
router.post(
  '/move',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const input = manualMoveSchema.parse(req.body);
    const actorId = req.user?.id ?? null;

    const result = await moveLearner(
      schoolId,
      input.learnerId,
      input.fromStreamId,
      input.toStreamId,
      input.academicYearId,
      input.classId,
      actorId ?? undefined
    );

    res.json(result);
  })
);

/**
 * GET /api/placement/history
 * Fetch placement history for audit/compliance.
 */
router.get(
  '/history',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = placementHistoryQuerySchema.parse(req.query);

    const history = await getPlacementHistory(schoolId, {
      classId: query.classId,
      streamId: query.streamId,
      learnerId: query.learnerId,
      academicYearId: query.academicYearId,
      limit: query.limit,
    });

    res.json({ history: history, count: history.length });
  })
);

/**
 * GET /api/placement/impact
 * Preview the impact of creating streams and reorganizing an unstreamed class.
 */
router.get(
  '/impact/:classId/:academicYearId',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { classId, academicYearId } = req.params;
    const proposedStreamCount = parseInt(req.query.proposedStreams as string) || 2;

    const view = await getClassPlacementView(schoolId, classId, academicYearId);

    const totalLearners = view.learners.length;
    const perStream = Math.floor(totalLearners / proposedStreamCount);
    const remainder = totalLearners % proposedStreamCount;

    // Teacher allocation implications
    const teacherWarnings: string[] = [];
    if (view.teacherAllocations.length > 0) {
      const hasStreamAllocations = view.teacherAllocations.some((a) => a.stream !== null);
      const hasClassLevelAllocation = view.teacherAllocations.some(
        (a) => a.class !== null && a.stream === null
      );

      if (hasClassLevelAllocation && !hasStreamAllocations) {
        teacherWarnings.push(
          'Class-level teacher allocations exist. After creating streams, assign a main class teacher to each stream through the Teacher Allocation module.'
        );
      }
      if (hasStreamAllocations) {
        teacherWarnings.push(
          'This class already has stream-level teacher allocations. Review them before reorganizing learners.'
        );
      }
    }

    res.json({
      class: view.class,
      academicYear: view.academicYear,
      currentStreams: view.streams.length,
      totalLearners,
      hasUnstreamedLearners: view.teacherAllocations.length > 0 || totalLearners > 0,
      proposedStreamCount,
      projectedStreamSizes: Array.from({ length: proposedStreamCount }, (_, i) =>
        i < remainder ? perStream + 1 : perStream
      ),
      teacherAllocationWarnings: teacherWarnings,
      teacherAllocations: view.teacherAllocations,
    });
  })
);

async function checkTeacherAllocationWarnings(
  schoolId: string,
  classId: string,
  academicYearId: string
): Promise<string[]> {
  const warnings: string[] = [];

  const streams = await prisma.stream.findMany({
    where: { classId, status: 'active' },
    select: { id: true, code: true, _count: { select: { enrollments: true } } },
  });

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

  // Check for class-level allocations that may need stream-level reassignment
  const classLevelAllocs = await prisma.streamAllocation.findMany({
    where: {
      classId,
      academicYearId,
      streamId: null,
      responsibility: 'main_class_teacher',
      status: 'active',
    },
    include: { teacher: { select: { name: true, email: true } } },
  });

  if (classLevelAllocs.length > 0 && streams.length > 0) {
    warnings.push(
      'Class-level main class teacher(s) exist. After creating streams, assign stream-level class teachers through the Teacher Allocation module.'
    );
  }

  return warnings;
}

function presentStream(stream: {
  id: string;
  name: string;
  code: string;
  capacity: number | null;
  status: string;
  _count: { enrollments: number };
}) {
  return {
    id: stream.id,
    name: stream.name,
    code: stream.code,
    capacity: stream.capacity,
    status: stream.status,
    learnerCount: stream._count.enrollments,
  };
}
