/**
 * Learning Areas - the catalogue of what the school teaches.
 *
 * A learning area is a `Subject`. That is the record the platform already
 * carries every relationship on - results reference it, teacher allocations
 * attach to it, examinations are made of it, courses and lessons hang off it -
 * so this module manages those records rather than owning a second catalogue
 * that would have to be kept in step with the first.
 *
 * The one distinction that matters operationally is where a learning area came
 * from:
 *
 *   custom     - the school defined it. Its name, code, grades and lifecycle
 *                are the school's to change.
 *   curriculum - it arrived from an authoritative curriculum source through
 *                synchronization. Changing or removing it here would silently
 *                diverge from that source, so the school is told to work in
 *                the curriculum workflow instead.
 *
 * There is no curriculum synchronization mechanism in this repository, and no
 * CBC curriculum records, strands, sub-strands or learning outcomes. That gap
 * is reported rather than papered over: the curriculum section stays empty
 * and says why, instead of being filled with invented areas that would then be
 * indistinguishable from real ones. Nothing here creates a `curriculum`-origin
 * record.
 *
 * Retiring a learning area is by status, not by deletion. Assessments, results,
 * allocations, grades, classes and courses reference an area by its stable id;
 * deleting the record would cascade some of those away and leave the rest
 * pointing at nothing, which would quietly rewrite the meaning of historical
 * academic records.
 *
 * Permissions:
 *   learningAreas.view   - read the catalogue
 *   learningAreas.manage - create, edit, retire and delete learning areas
 *
 * `learningAreas.manage` is held by DEAN and SUPER_ADMIN. Holding admin-portal
 * access alone never grants it, and a teacher keeps only `learningAreas.view`,
 * which is what their assigned areas need.
 */

import { Router, type Request, type Response } from 'express';
import { LearningAreaOrigin, LearningAreaStatus, GradeScope, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../audit-logs/service';

export const router: Router = Router();

router.use(requireSchoolScope());

const requireView = requirePermissions('learningAreas.view');
const requireManage = requirePermissions('learningAreas.manage');

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function assertObjectId(value: string, label = 'id'): string {
  if (!OBJECT_ID.test(value)) {
    throw new ApiError(400, `${label} must be a valid identifier`);
  }
  return value;
}

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.nativeEnum(LearningAreaStatus).optional(),
  gradeLevel: z.string().trim().min(1).optional(),
  origin: z.nativeEnum(LearningAreaOrigin).optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

/**
 * Grade scope is explicit in the payload rather than inferred from whether a
 * grade list was sent. `selected` with no grades is rejected; `all` with grades
 * is rejected. That is what keeps "taught everywhere" and "not configured"
 * from being the same empty array.
 */
const createSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(160),
    code: z
      .string()
      .trim()
      .max(32)
      .regex(/^[A-Za-z0-9._-]*$/, 'Use letters, numbers, dot, dash or underscore only.')
      .optional()
      .or(z.literal('')),
    description: z.string().trim().max(1000).optional().or(z.literal('')),
    gradeScope: z.nativeEnum(GradeScope).default(GradeScope.all),
    gradeLevels: z.array(z.string().trim().min(1).max(64)).max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.gradeScope === GradeScope.selected) {
      const grades = value.gradeLevels ?? [];
      if (grades.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Pick the grades this learning area is offered to, or set it to all grades.',
          path: ['gradeLevels'],
        });
      }
      // A repeated grade would double-count the area in that grade's listing.
      if (new Set(grades.map((grade) => grade.toLowerCase())).size !== grades.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'The same grade was listed more than once.',
          path: ['gradeLevels'],
        });
      }
    } else if ((value.gradeLevels ?? []).length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A learning area that applies to all grades cannot also list specific grades.',
        path: ['gradeLevels'],
      });
    }
  });

const updateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(160).optional(),
    code: z
      .string()
      .trim()
      .max(32)
      .regex(/^[A-Za-z0-9._-]*$/, 'Use letters, numbers, dot, dash or underscore only.')
      .optional()
      .nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    gradeScope: z.nativeEnum(GradeScope).optional(),
    gradeLevels: z.array(z.string().trim().min(1).max(64)).max(100).optional(),
    status: z.nativeEnum(LearningAreaStatus).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.gradeScope !== undefined && value.gradeLevels !== undefined) {
      if (value.gradeScope === GradeScope.selected && value.gradeLevels.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Pick the grades this learning area is offered to, or set it to all grades.',
          path: ['gradeLevels'],
        });
      }
      if (value.gradeScope === GradeScope.all && value.gradeLevels.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A learning area that applies to all grades cannot also list specific grades.',
          path: ['gradeLevels'],
        });
      }
    }
  });

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

/** Everything a screen needs to know about one learning area. */
const areaInclude = {
  gradeLevels: { orderBy: { gradeLevel: 'asc' } },
  _count: {
    select: {
      examinationSubjects: true,
      teachingAssignments: true,
      streamAllocations: true,
      courses: true,
      topics: true,
      classes: true,
      grades: true,
    },
  },
} satisfies Prisma.SubjectInclude;

type AreaWithCounts = Prisma.SubjectGetPayload<{ include: typeof areaInclude }>;

/** The references that make a hard delete unsafe. */
const DEPENDENCY_LABELS: Array<{ key: keyof AreaWithCounts['_count']; label: string }> = [
  { key: 'examinationSubjects', label: 'examinations (summative assessments)' },
  { key: 'teachingAssignments', label: 'teacher assignments' },
  { key: 'streamAllocations', label: 'stream allocations' },
  { key: 'courses', label: 'courses' },
  { key: 'classes', label: 'classes using it as their home learning area' },
  { key: 'topics', label: 'curriculum topics' },
  { key: 'grades', label: 'recorded grades and results' },
];

function mapArea(area: AreaWithCounts, gradeOptions?: string[]) {
  const counts = area._count;
  const dependencies = DEPENDENCY_LABELS.filter((dep) => (counts[dep.key] ?? 0) > 0).map((dep) => ({
    label: dep.label,
    count: counts[dep.key] ?? 0,
  }));

  return {
    id: area.id,
    name: area.name,
    code: area.code,
    description: area.description,
    status: area.status as LearningAreaStatus,
    origin: area.origin as LearningAreaOrigin,
    gradeScope: area.gradeScope as GradeScope,
    /**
     * The grades this area applies to, resolved rather than merely stored:
     * `all` reports every grade the school actually runs, so a screen never has
     * to re-implement the rule to show what "all" means here.
     */
    gradeLevels: area.gradeLevels.map((row) => row.gradeLevel),
    applicableGradeLevels:
      area.gradeScope === GradeScope.all
        ? (gradeOptions ?? area.gradeLevels.map((row) => row.gradeLevel))
        : area.gradeLevels.map((row) => row.gradeLevel),
    appliesToAllGrades: area.gradeScope === GradeScope.all,
    dependencies,
    hasDependencies: dependencies.length > 0,
    createdAt: area.createdAt,
    updatedAt: area.updatedAt,
  };
}

/** Groups areas by grade level so the screen can collapse a grade out of the way. */
function groupByGradeLevel(
  areas: Array<ReturnType<typeof mapArea>>,
  knownGrades: string[]
): Array<{ key: string; label: string; areas: Array<ReturnType<typeof mapArea>> }> {
  const groups = new Map<string, Array<ReturnType<typeof mapArea>>>();
  const multiGrade: Array<ReturnType<typeof mapArea>> = [];

  for (const area of areas) {
    // An area offered to several grades would appear once per grade if it were
    // simply repeated, so it gets its own group instead and is counted once.
    if (area.applicableGradeLevels.length > 1) {
      multiGrade.push(area);
      continue;
    }
    const grade = area.applicableGradeLevels[0] ?? 'Unassigned';
    const list = groups.get(grade) ?? [];
    list.push(area);
    groups.set(grade, list);
  }

  const ordered = [
    ...knownGrades.filter((grade) => groups.has(grade)),
    ...[...groups.keys()].filter((grade) => !knownGrades.includes(grade)),
  ].map((grade) => ({
    key: grade,
    label: grade,
    areas: (groups.get(grade) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
  }));

  if (multiGrade.length > 0) {
    ordered.push({
      key: '__multi__',
      label: 'Multiple grades',
      areas: multiGrade.slice().sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return ordered;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/**
 * The workspace: both sections in one response, plus the counts and the form
 * options, so the screen opens able to act without a second round trip.
 */
router.get(
  '/',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = listQuerySchema.parse(req.query);

    // Grade vocabulary comes from the school's own classes. Hardcoding a list
    // here would offer grades the school does not run.
    const classGradeRows = await prisma.class.findMany({
      where: { schoolId, gradeLevel: { not: null } },
      select: { gradeLevel: true },
      distinct: ['gradeLevel'],
    });
    const gradeOptions = classGradeRows
      .map((row) => row.gradeLevel)
      .filter((grade): grade is string => grade !== null)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const where: Prisma.SubjectWhereInput = {
      schoolId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.includeInactive ? {} : { status: LearningAreaStatus.active }),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // A grade filter has to respect scope: an "all grades" area matches every
    // grade, a "selected grades" area only the ones it lists.
    if (query.gradeLevel) {
      const grade = query.gradeLevel;
      where.AND = [
        {
          OR: [
            { gradeScope: GradeScope.all },
            { gradeScope: GradeScope.selected, gradeLevels: { some: { gradeLevel: grade } } },
          ],
        },
      ];
    }

    const areas = await prisma.subject.findMany({
      where,
      orderBy: { name: 'asc' },
      include: areaInclude,
    });

    const mapped = areas.map((area) => mapArea(area, gradeOptions));
    const custom = mapped.filter((area) => area.origin === LearningAreaOrigin.custom);
    const curriculum = mapped.filter((area) => area.origin === LearningAreaOrigin.curriculum);

    res.json({
      // Each area has exactly one origin, so these add up to `total` and nothing
      // is counted twice.
      summary: {
        total: mapped.length,
        customCount: custom.length,
        curriculumCount: curriculum.length,
        activeCount: mapped.filter((area) => area.status === LearningAreaStatus.active).length,
        inactiveCount: mapped.filter((area) => area.status === LearningAreaStatus.inactive).length,
        archivedCount: mapped.filter((area) => area.status === LearningAreaStatus.archived).length,
        appliesToAllGrades: mapped.filter((area) => area.appliesToAllGrades).length,
      },
      gradeOptions,
      customAreas: custom,
      curriculumAreas: curriculum,
      grouped: groupByGradeLevel(mapped, gradeOptions),
      // The curriculum workflow is not available in this repository, and the
      // screen states it rather than showing a silent empty table.
      curriculumSyncAvailable: false,
      curriculumSyncNote:
        'No curriculum synchronization source is configured in this repository, so no ' +
        'curriculum-defined learning areas exist yet. Nothing here claims otherwise: this ' +
        'section stays empty until a real curriculum source is connected.',
    });
  })
);

/** Form options: the school's grades, so nothing is hardcoded on the client. */
router.get(
  '/options',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const classGradeRows = await prisma.class.findMany({
      where: { schoolId, gradeLevel: { not: null } },
      select: { gradeLevel: true },
      distinct: ['gradeLevel'],
    });

    const gradeOptions = classGradeRows
      .map((row) => row.gradeLevel)
      .filter((grade): grade is string => grade !== null)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    res.json({
      gradeOptions,
      statuses: Object.values(LearningAreaStatus),
      gradeScopes: Object.values(GradeScope),
    });
  })
);

/** One learning area, for the edit form. */
/**
 * The learning areas a learner is taught.
 *
 * A learner's areas are the ones applicable to the grades they are placed in,
 * not the whole catalogue: a Grade 1 learner should not see Grade 7 areas just
 * because the school teaches them. Grades come from the classes the learner is
 * actually enrolled in, falling back to their profile's grade when they are on
 * record but not yet placed.
 */
/**
 * The learning areas a teacher is responsible for.
 *
 * Built from the teacher's own stream allocations, which is the record that says
 * who teaches what to whom — not from a list of every area in the school. A
 * teacher sees the areas they teach, and the classes they teach them in.
 */
/**
 * Creates a school-defined learning area.
 *
 * Always `custom`: there is no synchronization source to create curriculum
 * records from, and inventing one would make a school-defined area
 * indistinguishable from an official one.
 */
router.get(
  '/mine',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id;
    if (!actorId) {
      throw new ApiError(401, 'Sign in to see your learning areas.');
    }

    // Placed grades first: a learner enrolled in a Grade 1 class in this school
    // is a Grade 1 learner for this request, whatever their profile says.
    const placementGrades = await prisma.enrollment.findMany({
      where: { studentId: actorId, class: { schoolId } },
      select: { class: { select: { gradeLevel: true, id: true, name: true } } },
    });

    const gradeLevels = [
      ...new Set(
        placementGrades
          .map((row) => row.class.gradeLevel)
          .filter((grade): grade is string => Boolean(grade))
      ),
    ];

    if (gradeLevels.length === 0) {
      // Unplaced but on record: the profile's grade is all there is to go on.
      const profile = await prisma.studentProfile.findFirst({
        where: { userId: actorId },
        select: { gradeLevel: true },
      });
      if (profile?.gradeLevel) gradeLevels.push(profile.gradeLevel);
    }

    if (gradeLevels.length === 0) {
      res.json({
        gradeLevels: [],
        areas: [],
        message:
          'You are not yet placed in a class, so there are no learning areas to show. Ask an ' +
          'administrator to place you in a class.',
      });
      return;
    }

    // An area reaches this learner when it is taught in every grade, or when it
    // names one of the grades they are in.
    const areas = await prisma.subject.findMany({
      where: {
        schoolId,
        status: LearningAreaStatus.active,
        OR: [
          { gradeScope: GradeScope.all },
          {
            gradeScope: GradeScope.selected,
            gradeLevels: { some: { gradeLevel: { in: gradeLevels } } },
          },
        ],
      },
      include: areaInclude,
      orderBy: { name: 'asc' },
    });

    res.json({
      gradeLevels,
      classes: placementGrades
        .map((row) => row.class)
        .filter((cls, index, all) => all.findIndex((c) => c.id === cls.id) === index)
        .map((cls) => ({ id: cls.id, name: cls.name, gradeLevel: cls.gradeLevel })),
      areas: areas.map((area) => mapArea(area, gradeLevels)),
    });
  })
);

router.get(
  '/teaching',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id;
    if (!actorId) {
      throw new ApiError(401, 'Sign in to see your learning areas.');
    }

    const allocations = await prisma.streamAllocation.findMany({
      where: {
        schoolId,
        teacherId: actorId,
        status: 'active',
        subjectId: { not: null },
      },
      select: {
        responsibility: true,
        canEnterResults: true,
        canManage: true,
        subject: {
          include: areaInclude,
        },
        stream: {
          select: {
            id: true,
            name: true,
            code: true,
            class: { select: { id: true, name: true, gradeLevel: true } },
          },
        },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { effectiveFrom: 'asc' },
    });

    // One entry per (area, class, stream): the same area taught in three streams
    // is one area the teacher is responsible for, shown against each stream it
    // runs in. Counting the area once would hide two thirds of the work, and
    // surfacing three separate "areas" would misreport what they teach.
    const seen = new Set<string>();
    const teaching: Array<Record<string, unknown>> = [];

    for (const allocation of allocations) {
      if (!allocation.subject) continue;
      const key = `${allocation.subject.id}:${allocation.stream.class.id}:${allocation.stream.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      teaching.push({
        area: mapArea(allocation.subject),
        responsibility: allocation.responsibility,
        canEnterResults: allocation.canEnterResults,
        canManage: allocation.canManage,
        stream: {
          id: allocation.stream.id,
          name: allocation.stream.name,
          code: allocation.stream.code,
          class: allocation.stream.class,
        },
        academicYear: allocation.academicYear,
      });
    }

    res.json({
      teaching,
      areaCount: new Set(allocations.filter((a) => a.subject).map((a) => a.subject!.id)).size,
      streamCount: new Set(allocations.map((a) => a.stream.id)).size,
    });
  })
);

router.get(
  '/:id',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const id = assertObjectId(req.params.id, 'learning area id');

    const area = await prisma.subject.findFirst({ where: { id, schoolId }, include: areaInclude });
    if (!area) {
      throw new ApiError(404, 'Learning area not found.');
    }

    res.json({ area: mapArea(area) });
  })
);

router.post(
  '/',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = createSchema.parse(req.body);
    const actorId = req.user?.id ?? null;

    // Name and code are unique per school, so the check is scoped rather than
    // trusting the global index to produce a readable error.
    const nameTaken = await prisma.subject.findFirst({
      where: { schoolId, name: { equals: payload.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (nameTaken) {
      throw new ApiError(409, 'A learning area with that name already exists in your school.');
    }

    const code = payload.code?.trim() ? payload.code.trim() : null;
    if (code) {
      const codeTaken = await prisma.subject.findFirst({
        where: { schoolId, code },
        select: { id: true },
      });
      if (codeTaken) {
        throw new ApiError(409, 'That code is already used by another learning area.');
      }
    }

    const gradeLevels =
      payload.gradeScope === GradeScope.selected ? (payload.gradeLevels ?? []) : [];
    await assertGradesExist(schoolId, gradeLevels);

    const area = await prisma.$transaction(async (tx) => {
      const created = await tx.subject.create({
        data: {
          schoolId,
          name: payload.name,
          code,
          description: payload.description?.trim() ? payload.description.trim() : null,
          status: LearningAreaStatus.active,
          origin: LearningAreaOrigin.custom,
          gradeScope: payload.gradeScope,
          ...(gradeLevels.length > 0
            ? { gradeLevels: { create: gradeLevels.map((gradeLevel) => ({ gradeLevel })) } }
            : {}),
        },
        include: areaInclude,
      });
      return created;
    });

    await recordAuditLog(
      actorId,
      'learningAreas.created',
      `Created learning area ${area.name}${code ? ` (${code})` : ''} for grades: ${
        payload.gradeScope === GradeScope.all ? 'all grades' : gradeLevels.join(', ')
      }.`,
      schoolId
    );

    res.status(201).json({ area: mapArea(area) });
  })
);

/**
 * Updates a learning area.
 *
 * Curriculum-origin areas are refused rather than edited: their content comes
 * from the curriculum source, and changing it here would make the two disagree
 * without anything recording that they ever did.
 */
router.patch(
  '/:id',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const id = assertObjectId(req.params.id, 'learning area id');
    const payload = updateSchema.parse(req.body);
    const actorId = req.user?.id ?? null;

    const existing = await prisma.subject.findFirst({
      where: { id, schoolId },
      include: { gradeLevels: true },
    });
    if (!existing) {
      throw new ApiError(404, 'Learning area not found.');
    }
    if (existing.origin === LearningAreaOrigin.curriculum) {
      throw new ApiError(
        403,
        'This learning area is synchronized from the curriculum and cannot be edited here. ' +
          'Change it in the curriculum source and re-synchronize.'
      );
    }

    const data: Prisma.SubjectUpdateInput = {};

    if (payload.name !== undefined && payload.name !== existing.name) {
      // Renaming is safe for history: assessments, grades and allocations all
      // point at the record's id, not at its name.
      const taken = await prisma.subject.findFirst({
        where: {
          schoolId,
          name: { equals: payload.name, mode: 'insensitive' },
          id: { not: existing.id },
        },
        select: { id: true },
      });
      if (taken) {
        throw new ApiError(409, 'A learning area with that name already exists in your school.');
      }
      data.name = payload.name;
    }

    if (payload.code !== undefined) {
      const nextCode = payload.code?.trim() ? payload.code.trim() : null;
      if (nextCode && nextCode !== existing.code) {
        const taken = await prisma.subject.findFirst({
          where: { schoolId, code: nextCode, id: { not: existing.id } },
          select: { id: true },
        });
        if (taken) {
          throw new ApiError(409, 'That code is already used by another learning area.');
        }
      }
      data.code = nextCode;
    }

    if (payload.description !== undefined) {
      data.description = payload.description?.trim() ? payload.description.trim() : null;
    }

    if (payload.status !== undefined) {
      data.status = payload.status;
    }

    // Grade applicability, with the empty-list ambiguity resolved from the
    // existing record when only one half of the pair is sent.
    let gradeScope = existing.gradeScope as GradeScope;
    if (payload.gradeScope !== undefined) {
      gradeScope = payload.gradeScope;
      data.gradeScope = gradeScope;
    }
    if (payload.gradeLevels !== undefined) {
      gradeScope = payload.gradeScope ?? gradeScope;
      if (gradeScope === GradeScope.all && payload.gradeLevels.length > 0) {
        throw new ApiError(
          400,
          'A learning area that applies to all grades cannot also list specific grades.'
        );
      }
      if (gradeScope === GradeScope.selected && payload.gradeLevels.length === 0) {
        throw new ApiError(
          400,
          'Pick the grades this learning area is offered to, or set the learning area to all grades.'
        );
      }
      data.gradeScope = gradeScope;
      await assertGradesExist(schoolId, payload.gradeLevels);
    }

    const area = await prisma.$transaction(async (tx) => {
      const updated = await tx.subject.update({
        where: { id: existing.id },
        data,
        include: areaInclude,
      });

      if (payload.gradeLevels !== undefined) {
        // Replace rather than merge, so removing a grade in the form removes it
        // here too instead of leaving a stale row behind.
        await tx.subjectGradeLevel.deleteMany({ where: { subjectId: existing.id } });
        if (payload.gradeLevels.length > 0) {
          await tx.subjectGradeLevel.createMany({
            data: payload.gradeLevels.map((gradeLevel) => ({
              subjectId: existing.id,
              gradeLevel,
            })),
          });
        }
      }

      return updated;
    });

    await recordAuditLog(
      actorId,
      'learningAreas.updated',
      `Updated learning area ${area.name}: ${describeChange(payload, existing)}`,
      schoolId
    );

    res.json({ area: mapArea(area) });
  })
);

/**
 * Deletes a learning area, but only one nothing depends on.
 *
 * This is the dependency-aware part of the lifecycle. `TeachingAssignment` and
 * `ExaminationSubject` cascade from a subject, and `StreamAllocation`, `Grade`,
 * `Class` and `Lesson` null their reference, so a delete here would not merely
 * remove a catalogue row - it would strip the learning area out of finished
 * assessments and orphan the results recorded against it. When anything still
 * references the area the delete is refused and deactivation is offered
 * instead, which keeps the academic record intact.
 */
router.delete(
  '/:id',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const id = assertObjectId(req.params.id, 'learning area id');
    const actorId = req.user?.id ?? null;

    const existing = await prisma.subject.findFirst({
      where: { id, schoolId },
      include: areaInclude,
    });
    if (!existing) {
      throw new ApiError(404, 'Learning area not found.');
    }
    if (existing.origin === LearningAreaOrigin.curriculum) {
      throw new ApiError(
        403,
        'This learning area is synchronized from the curriculum and cannot be deleted here. ' +
          'Remove it in the curriculum source and re-synchronize.'
      );
    }

    const blocked = DEPENDENCY_LABELS.filter((dep) => (existing._count[dep.key] ?? 0) > 0);
    if (blocked.length > 0) {
      const detail = blocked.map((dep) => `${existing._count[dep.key]} ${dep.label}`).join(', ');
      throw new ApiError(
        409,
        `This learning area is still referenced by ${detail}. Deactivate it instead: that ` +
          'retires it from new work while keeping existing assessments, results and ' +
          'allocations readable.'
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.subjectGradeLevel.deleteMany({ where: { subjectId: existing.id } });
      await tx.subject.delete({ where: { id: existing.id } });
    });

    await recordAuditLog(
      actorId,
      'learningAreas.deleted',
      `Deleted learning area ${existing.name}.`
    );

    res.status(204).send();
  })
);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Rejects any grade that no class in the school uses.
 *
 * The grade vocabulary is the school's own, read from its classes, so a
 * learning area can never be scoped to a grade that does not exist here.
 */
async function assertGradesExist(schoolId: string, gradeLevels: string[]): Promise<void> {
  if (gradeLevels.length === 0) return;

  const rows = await prisma.class.findMany({
    where: { schoolId, gradeLevel: { in: gradeLevels } },
    select: { gradeLevel: true },
    distinct: ['gradeLevel'],
  });
  const known = new Set(rows.map((row) => row.gradeLevel).filter(Boolean) as string[]);
  const unknown = gradeLevels.filter((grade) => !known.has(grade));

  if (unknown.length > 0) {
    throw new ApiError(
      400,
      `No class in your school uses these grades: ${unknown.join(', ')}. ` +
        'Pick from the grades your school actually runs.'
    );
  }
}

function describeChange(
  payload: z.infer<typeof updateSchema>,
  existing: { name: string; status: LearningAreaStatus; gradeScope: GradeScope }
): string {
  const changes: string[] = [];
  if (payload.name !== undefined && payload.name !== existing.name) {
    changes.push(`name ${existing.name} -> ${payload.name}`);
  }
  if (payload.status !== undefined && payload.status !== existing.status) {
    changes.push(`status ${existing.status} -> ${payload.status}`);
  }
  if (payload.gradeScope !== undefined && payload.gradeScope !== existing.gradeScope) {
    changes.push(`grades: ${existing.gradeScope} -> ${payload.gradeScope}`);
  }
  if (payload.gradeLevels !== undefined) {
    changes.push(`grades: ${payload.gradeLevels.join(', ') || 'none'}`);
  }
  if (payload.code !== undefined) changes.push('code');
  if (payload.description !== undefined) changes.push('description');
  return changes.length > 0 ? changes.join('; ') : 'no changes.';
}

/**
 * Eligibility rule shared with the other academic surfaces.
 *
 * An area is offered for teaching, assessment and results when it is active and
 * either applies to every grade or explicitly lists the grade in question.
 * Exported so Results Entry, summative assessment and reporting resolve this the
 * same way rather than each re-deriving it.
 *
 * `gradeLevels` is the plain string list the API already returns, not the
 * relation's row shape: a caller reading a response body or a mapped record has
 * strings, and making them rebuild objects to use this would be the kind of
 * friction that leads to each module re-implementing the rule instead.
 */
export function isLearningAreaEligible(
  area: {
    status: string;
    gradeScope: string;
    gradeLevels: string[];
  },
  gradeLevel?: string | null
): boolean {
  if (area.status !== LearningAreaStatus.active) return false;
  if (area.gradeScope === GradeScope.all) return true;
  if (area.gradeScope === GradeScope.selected) {
    if (!gradeLevel) return false;
    return area.gradeLevels.includes(gradeLevel);
  }
  return false;
}
