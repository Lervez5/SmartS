/**
 * Grades - canonical grade level catalogue for a school.
 *
 * A grade level is the educational stage a school teaches (e.g. "Pre Primary 1",
 * "Grade 1", "Crèche"). This module provides the authoritative CRUD surface for
 * grade levels, scoped to the caller's school.
 *
 * Grade levels are referenced by:
 * - Classes (Class.gradeLevel is a free-text label that mirrors the designationCode)
 * - Learning Areas (SubjectGradeLevel records link areas to grade levels)
 * - Student Profiles (StudentProfile.gradeLevel is a free-text label)
 *
 * Deactivating a grade level prevents new classes from being created at that level,
 * but does NOT delete it. Existing classes, streams, learners, allocations,
 * assessments, results and reports retain their references.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { recordAuditLog } from '../audit-logs/service';

export const router: Router = Router();

router.use(requireSchoolScope());

const requireView = requirePermissions('grades.view');
const requireManage = requirePermissions('grades.manage');

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1, 'Grade name is required.').max(120),
  designationCode: z.string().trim().min(1, 'Designation code is required.').max(32),
  academicLevel: z.coerce
    .number()
    .int('Academic level must be a whole number, including negative values.')
    .refine((n) => n >= -99 && n <= 99, 'Academic level must be between -99 and 99.'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  designationCode: z.string().trim().min(1).max(32).optional(),
  academicLevel: z.coerce
    .number()
    .int('Academic level must be a whole number, including negative values.')
    .refine((n) => n >= -99 && n <= 99, 'Academic level must be between -99 and 99.')
    .optional(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * Check whether a grade level is referenced by any existing data that we must
 * not break. Returns a list of dependency descriptions.
 */
async function checkDependencies(
  schoolId: string,
  gradeLevelId: string
): Promise<{ label: string; count: number }[]> {
  const gradeLevel = await prisma.gradeLevel.findUnique({
    where: { id: gradeLevelId },
    select: { designationCode: true, name: true },
  });

  if (!gradeLevel) {
    return [];
  }

  const code = gradeLevel.designationCode;

  const [classCount, profileCount, areaCount] = await Promise.all([
    prisma.class.count({
      where: { schoolId, gradeLevel: code },
    }),
    prisma.studentProfile.count({
      where: { user: { schoolMemberships: { some: { schoolId } } }, gradeLevel: code },
    }),
    prisma.subjectGradeLevel.count({
      where: { subject: { schoolId }, gradeLevel: code },
    }),
  ]);

  const deps: { label: string; count: number }[] = [];
  if (classCount > 0) deps.push({ label: 'classes', count: classCount });
  if (profileCount > 0) deps.push({ label: 'student profiles', count: profileCount });
  if (areaCount > 0) deps.push({ label: 'learning areas', count: areaCount });
  return deps;
}

/**
 * Format the grade level for response, resolving references from the related
 * school and adding dependency counts.
 */
function presentGradeLevel(gradeLevel: {
  id: string;
  designationCode: string;
  name: string;
  academicLevel: number;
  description: string | null;
  status: string;
  origin: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { classes: number };
}) {
  return {
    id: gradeLevel.id,
    designationCode: gradeLevel.designationCode,
    name: gradeLevel.name,
    academicLevel: gradeLevel.academicLevel,
    description: gradeLevel.description,
    status: gradeLevel.status,
    origin: gradeLevel.origin,
    classCount: gradeLevel._count?.classes ?? 0,
    createdAt: gradeLevel.createdAt.toISOString(),
    updatedAt: gradeLevel.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/**
 * GET /api/grades
 * List all grade levels for the school, sorted by academic level.
 */
router.get(
  '/',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = listQuerySchema.parse(req.query);

    const where: any = { schoolId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { designationCode: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const grades = await prisma.gradeLevel.findMany({
      where,
      orderBy: { academicLevel: 'asc' },
      select: {
        id: true,
        designationCode: true,
        name: true,
        academicLevel: true,
        description: true,
        status: true,
        origin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const classCounts = await prisma.class.count({
      where: { schoolId, gradeLevel: { in: grades.map((g) => g.designationCode) } },
    });

    res.json({
      grades: grades.map(presentGradeLevel),
      count: grades.length,
    });
  })
);

/**
 * GET /api/grades/options
 * Return grade options for form dropdowns — just code and name.
 */
router.get(
  '/options',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const grades = await prisma.gradeLevel.findMany({
      where: { schoolId, status: 'active' },
      select: { id: true, designationCode: true, name: true, academicLevel: true },
      orderBy: { academicLevel: 'asc' },
    });

    res.json({
      gradeOptions: grades.map((g) => ({
        id: g.id,
        code: g.designationCode,
        name: g.name,
        academicLevel: g.academicLevel,
        label: g.designationCode,
      })),
    });
  })
);

/**
 * POST /api/grades
 * Create a new grade level.
 */
router.post(
  '/',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = createSchema.parse(req.body);
    const actorId = req.user?.id ?? null;

    // Check for duplicate designation code within this school
    const existingCode = await prisma.gradeLevel.findFirst({
      where: { schoolId, designationCode: payload.designationCode },
      select: { id: true },
    });
    if (existingCode) {
      throw new ApiError(
        400,
        `Grade "${payload.designationCode}" already exists. Use a different designation code.`
      );
    }

    // Check for duplicate name within this school
    const existingName = await prisma.gradeLevel.findFirst({
      where: { schoolId, name: payload.name },
      select: { id: true },
    });
    if (existingName) {
      throw new ApiError(400, `Grade "${payload.name}" already exists. Use a different name.`);
    }

    const gradeLevel = await prisma.gradeLevel.create({
      data: {
        schoolId,
        name: payload.name,
        designationCode: payload.designationCode,
        academicLevel: payload.academicLevel,
        description: payload.description?.trim() || null,
        status: payload.status ?? 'active',
        origin: 'custom',
      },
      select: {
        id: true,
        designationCode: true,
        name: true,
        academicLevel: true,
        description: true,
        status: true,
        origin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await recordAuditLog(
      actorId,
      'grades.created',
      `Created grade "${payload.name}" (${payload.designationCode}) at academic level ${payload.academicLevel}.`,
      schoolId
    );

    res.status(201).json({ grade: presentGradeLevel(gradeLevel) });
  })
);

/**
 * GET /api/grades/:id
 * Get a single grade level with its class count.
 */
router.get(
  '/:id',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { id } = req.params;

    const gradeLevel = await prisma.gradeLevel.findFirst({
      where: { id, schoolId },
      select: {
        id: true,
        designationCode: true,
        name: true,
        academicLevel: true,
        description: true,
        status: true,
        origin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!gradeLevel) {
      throw new ApiError(404, 'Grade level not found.');
    }

    const classCount = await prisma.class.count({
      where: { schoolId, gradeLevel: gradeLevel.designationCode },
    });

    res.json({ grade: presentGradeLevel({ ...gradeLevel, _count: { classes: classCount } }) });
  })
);

/**
 * PATCH /api/grades/:id
 * Update a grade level.
 */
router.patch(
  '/:id',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { id } = req.params;
    const payload = updateSchema.parse(req.body);
    const actorId = req.user?.id ?? null;

    const existing = await prisma.gradeLevel.findFirst({
      where: { id, schoolId },
      select: { id: true, designationCode: true, name: true, origin: true, status: true },
    });

    if (!existing) {
      throw new ApiError(404, 'Grade level not found.');
    }

    // Curriculum-defined grades can be deactivated but not renamed
    if (existing.origin === 'curriculum') {
      if (payload.name !== undefined && payload.name !== existing.name) {
        throw new ApiError(
          403,
          'Curriculum-defined grades cannot be renamed. Contact the curriculum administrator.'
        );
      }
      if (
        payload.designationCode !== undefined &&
        payload.designationCode !== existing.designationCode
      ) {
        throw new ApiError(
          403,
          'Curriculum-defined grades cannot have their designation code changed.'
        );
      }
      if (payload.academicLevel !== undefined) {
        throw new ApiError(
          403,
          'Curriculum-defined grades cannot have their academic level changed.'
        );
      }
    }

    const data: any = {};

    if (payload.name !== undefined) {
      const clash = await prisma.gradeLevel.findFirst({
        where: { schoolId, name: payload.name, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        throw new ApiError(400, `Grade "${payload.name}" already exists.`);
      }
      data.name = payload.name;
    }

    if (payload.designationCode !== undefined) {
      const clash = await prisma.gradeLevel.findFirst({
        where: { schoolId, designationCode: payload.designationCode, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        throw new ApiError(400, `Grade "${payload.designationCode}" already exists.`);
      }
      data.designationCode = payload.designationCode;
    }

    if (payload.academicLevel !== undefined) {
      data.academicLevel = payload.academicLevel;
    }

    if (payload.description !== undefined) {
      data.description = payload.description?.trim() || null;
    }

    if (payload.status !== undefined) {
      // Prevent deactivation without a clear dependency warning
      if (payload.status === 'inactive' && existing.status === 'active') {
        const deps = await checkDependencies(schoolId, id);
        if (deps.length > 0) {
          const detail = deps.map((d) => `${d.count} ${d.label}`).join(', ');
          throw new ApiError(
            409,
            `This grade is referenced by ${detail}. You can deactivate it, but existing references will be preserved. Set status to "inactive" to proceed if you want to retire it from future use.`
          );
        }
      }
      data.status = payload.status;
    }

    const updated = await prisma.gradeLevel.update({
      where: { id },
      data,
      select: {
        id: true,
        designationCode: true,
        name: true,
        academicLevel: true,
        description: true,
        status: true,
        origin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const changes: string[] = [];
    if (payload.name !== undefined) changes.push(`name: ${existing.name} → ${payload.name}`);
    if (payload.designationCode !== undefined)
      changes.push(`code: ${existing.designationCode} → ${payload.designationCode}`);
    if (payload.academicLevel !== undefined) changes.push(`level: ${payload.academicLevel}`);
    if (payload.description !== undefined) changes.push('description');
    if (payload.status !== undefined)
      changes.push(`status: ${existing.status} → ${payload.status}`);

    await recordAuditLog(
      actorId,
      'grades.updated',
      `Updated grade "${existing.designationCode}": ${changes.length > 0 ? changes.join('; ') : 'no changes'}.`,
      schoolId
    );

    res.json({ grade: presentGradeLevel({ ...updated, _count: { classes: 0 } }) });
  })
);

/**
 * DELETE /api/grades/:id
 * Grades cannot be hard-deleted while referenced. This endpoint is reserved
 * for fully unreferenced custom grades and is intentionally blocked for curriculum grades.
 */
router.delete(
  '/:id',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const { id } = req.params;
    const actorId = req.user?.id ?? null;

    const existing = await prisma.gradeLevel.findFirst({
      where: { id, schoolId },
      select: { id: true, designationCode: true, name: true, origin: true },
    });

    if (!existing) {
      throw new ApiError(404, 'Grade level not found.');
    }

    if (existing.origin === 'curriculum') {
      throw new ApiError(
        403,
        'Curriculum-defined grades cannot be deleted. Deactivate them instead.'
      );
    }

    const deps = await checkDependencies(schoolId, id);
    if (deps.length > 0) {
      const detail = deps.map((d) => `${d.count} ${d.label}`).join(', ');
      throw new ApiError(
        409,
        `This grade is referenced by ${detail}. Deactivating it preserves all references while preventing new classes from using it.`
      );
    }

    await prisma.gradeLevel.delete({ where: { id } });

    await recordAuditLog(
      actorId,
      'grades.deleted',
      `Deleted grade "${existing.name}" (${existing.designationCode}).`,
      schoolId
    );

    res.status(204).send();
  })
);
