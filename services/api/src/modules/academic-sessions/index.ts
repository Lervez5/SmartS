/**
 * Academic sessions and terms.
 *
 * A session (`AcademicYear`) is the school's academic year; a `Term` is an
 * individual academic period inside it. They stay distinct because the admin
 * navbar selects a session while assessments, attendance and reporting operate
 * within a term.
 *
 * This is the authoritative session system. The admin navbar reads it rather
 * than the free-text `SchoolAcademicSettings.currentAcademicYearId`, which had
 * no record to point at.
 *
 * Every count returned here is computed from live collections: invoices and
 * receipts within the session's dates, and learners whose enrolment date falls
 * inside them.
 */

import { Router, type Request, type Response } from 'express';
import { AcademicSessionStatus, TermStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

export const router: Router = Router();

const sessionStatus = z.nativeEnum(AcademicSessionStatus);
const termStatus = z.nativeEnum(TermStatus);

const createSessionSchema = z
  .object({
    name: z.string().trim().min(2).max(32),
    label: z.string().trim().max(120).optional().or(z.literal('')),
    startDate: z.string().min(10),
    endDate: z.string().min(10),
    status: sessionStatus.optional(),
  })
  .refine((value) => new Date(value.endDate) > new Date(value.startDate), {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });

const updateSessionSchema = z
  .object({
    name: z.string().trim().min(2).max(32).optional(),
    label: z.string().trim().max(120).optional().or(z.literal('')),
    startDate: z.string().min(10).optional(),
    endDate: z.string().min(10).optional(),
    status: sessionStatus.optional(),
  })
  .refine(
    (value) =>
      !(value.startDate && value.endDate) || new Date(value.endDate) > new Date(value.startDate),
    { message: 'End date must be after the start date', path: ['endDate'] }
  );

const createTermSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    termNumber: z.coerce.number().int().min(1).max(12),
    startDate: z.string().min(10),
    endDate: z.string().min(10),
    status: termStatus.optional(),
  })
  .refine((value) => new Date(value.endDate) > new Date(value.startDate), {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });

const updateTermSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  startDate: z.string().min(10).optional(),
  endDate: z.string().min(10).optional(),
  status: termStatus.optional(),
});

const listSchema = z.object({
  status: sessionStatus.optional(),
  search: z.string().optional(),
  sort: z.enum(['start_desc', 'start_asc', 'name_asc', 'name_desc']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * Counts that genuinely belong to a session.
 *
 * Financial and learner activity are attributed to a session by falling inside
 * its date range: an invoice by its issue date, a receipt by when it was
 * received, a learner by when they enrolled. No metric is invented to fill the
 * column.
 */
async function summarise(session: { startDate: Date; endDate: Date }) {
  const window = { gte: session.startDate, lte: session.endDate };

  const [invoiceCount, receiptCount, learnerCount] = await Promise.all([
    prisma.invoice.count({ where: { issuedAt: window } }),
    prisma.receipt.count({ where: { receivedAt: window } }),
    prisma.studentProfile.count({ where: { enrollmentDate: window } }),
  ]);

  return { invoiceCount, receiptCount, learnerCount };
}

function present(session: {
  id: string;
  name: string;
  label: string | null;
  startDate: Date;
  endDate: Date;
  status: AcademicSessionStatus;
  terms: Array<{ id: string; name: string; termNumber: number; status: TermStatus }>;
}) {
  return {
    id: session.id,
    name: session.name,
    label: session.label,
    startDate: session.startDate,
    endDate: session.endDate,
    status: session.status,
    isActive: session.status === 'active',
    termCount: session.terms.length,
    terms: session.terms
      .slice()
      .sort((a, b) => a.termNumber - b.termNumber)
      .map((term) => ({
        id: term.id,
        name: term.name,
        termNumber: term.termNumber,
        status: term.status,
      })),
  };
}

/**
 * Activating a session deactivates whichever was active.
 *
 * The navbar and every module that resolves "the current session" rely on
 * exactly one being active, so the invariant is enforced on write rather than
 * left to the caller.
 */
async function setActiveStatus(sessionId: string, status: AcademicSessionStatus) {
  return prisma.$transaction(async (tx) => {
    if (status === 'active') {
      await tx.academicYear.updateMany({
        where: { status: 'active', id: { not: sessionId } },
        data: { status: 'completed' },
      });
    }
    return tx.academicYear.update({ where: { id: sessionId }, data: { status } });
  });
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

router.get(
  '/',
  requirePermissions('academics.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    // Declared with an explicit type so the lookup stays typed; without it the
    // whole query result degrades to the bare model shape.
    const orderBy: Prisma.AcademicYearOrderByWithRelationInput =
      query.sort === 'start_asc'
        ? { startDate: 'asc' }
        : query.sort === 'name_asc'
          ? { name: 'asc' }
          : query.sort === 'name_desc'
            ? { name: 'desc' }
            : { startDate: 'desc' };

    const sessions = await prisma.academicYear.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { label: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        terms: { select: { id: true, name: true, termNumber: true, status: true } },
      },
      orderBy,
      ...(query.limit ? { take: query.limit } : {}),
    });

    const summaries = await Promise.all(sessions.map((session) => summarise(session)));

    res.json({
      sessions: sessions.map((session, index) => ({
        ...present(session),
        data: summaries[index],
      })),
    });
  })
);

/**
 * The session the rest of the platform should treat as current.
 *
 * Kept as its own route so the navbar does not have to download every session
 * and decide for itself which one counts.
 */
router.get(
  '/current',
  requirePermissions('academics.view'),
  asyncHandler(async (_req: Request, res: Response) => {
    const session = await prisma.academicYear.findFirst({
      where: { status: 'active' },
      include: {
        terms: { select: { id: true, name: true, termNumber: true, status: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!session) {
      res.json({ session: null });
      return;
    }

    res.json({ session: { ...present(session), data: await summarise(session) } });
  })
);

router.get(
  '/:id',
  requirePermissions('academics.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const session = await prisma.academicYear.findUnique({
      where: { id: req.params.id },
      include: { terms: true },
    });
    if (!session) throw new ApiError(404, 'Academic session not found');

    res.json({ session: { ...present(session), data: await summarise(session) } });
  })
);

router.post(
  '/',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSessionSchema.parse(req.body);

    const existing = await prisma.academicYear.findUnique({ where: { name: payload.name } });
    if (existing) {
      throw new ApiError(409, `An academic session named "${payload.name}" already exists`);
    }

    const status = payload.status ?? 'planned';

    const session = await prisma.$transaction(async (tx) => {
      if (status === 'active') {
        await tx.academicYear.updateMany({
          where: { status: 'active' },
          data: { status: 'completed' },
        });
      }
      return tx.academicYear.create({
        data: {
          name: payload.name,
          label: payload.label || null,
          startDate: new Date(payload.startDate),
          endDate: new Date(payload.endDate),
          status,
        },
      });
    });

    const created = await prisma.academicYear.findUniqueOrThrow({
      where: { id: session.id },
      include: { terms: true },
    });

    res.status(201).json({ session: { ...present(created), data: await summarise(created) } });
  })
);

router.patch(
  '/:id',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = updateSessionSchema.parse(req.body);
    const existing = await prisma.academicYear.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Academic session not found');

    // Validate the resulting range, not just the submitted one: a partial edit
    // must not leave the session with an end date before its start.
    const nextStart = payload.startDate ? new Date(payload.startDate) : existing.startDate;
    const nextEnd = payload.endDate ? new Date(payload.endDate) : existing.endDate;
    if (nextEnd <= nextStart) {
      throw new ApiError(400, 'End date must be after the start date');
    }

    if (payload.name && payload.name !== existing.name) {
      const clash = await prisma.academicYear.findUnique({ where: { name: payload.name } });
      if (clash) {
        throw new ApiError(409, `An academic session named "${payload.name}" already exists`);
      }
    }

    const data: Prisma.AcademicYearUpdateInput = {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.label !== undefined ? { label: payload.label || null } : {}),
      ...(payload.startDate !== undefined ? { startDate: new Date(payload.startDate) } : {}),
      ...(payload.endDate !== undefined ? { endDate: new Date(payload.endDate) } : {}),
    };

    const updated =
      payload.status !== undefined
        ? await setActiveStatus(req.params.id, payload.status)
        : await prisma.academicYear.update({ where: { id: req.params.id }, data });

    const saved = await prisma.academicYear.findUniqueOrThrow({
      where: { id: updated.id },
      include: { terms: true },
    });

    res.json({ session: { ...present(saved), data: await summarise(saved) } });
  })
);

/* ------------------------------------------------------------------ *
 * Terms within a session
 * ------------------------------------------------------------------ */

router.post(
  '/:id/terms',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createTermSchema.parse(req.body);

    const session = await prisma.academicYear.findUnique({ where: { id: req.params.id } });
    if (!session) throw new ApiError(404, 'Academic session not found');

    const clash = await prisma.term.findUnique({
      where: {
        academicYearId_termNumber: { academicYearId: session.id, termNumber: payload.termNumber },
      },
    });
    if (clash) {
      throw new ApiError(409, `Term ${payload.termNumber} already exists in ${session.name}`);
    }

    const term = await prisma.term.create({
      data: {
        academicYearId: session.id,
        name: payload.name,
        termNumber: payload.termNumber,
        startDate: new Date(payload.startDate),
        endDate: new Date(payload.endDate),
        status: payload.status ?? 'planned',
      },
    });

    res.status(201).json({ term });
  })
);

router.patch(
  '/:id/terms/:termId',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = updateTermSchema.parse(req.body);

    const term = await prisma.term.findUnique({
      where: { id: req.params.termId },
      include: { academicYear: true },
    });
    if (!term || term.academicYearId !== req.params.id) {
      throw new ApiError(404, 'Term not found in this academic session');
    }

    const nextStart = payload.startDate ? new Date(payload.startDate) : term.startDate;
    const nextEnd = payload.endDate ? new Date(payload.endDate) : term.endDate;
    if (nextEnd <= nextStart) {
      throw new ApiError(400, 'End date must be after the start date');
    }

    const updated = await prisma.term.update({
      where: { id: term.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.startDate !== undefined ? { startDate: new Date(payload.startDate) } : {}),
        ...(payload.endDate !== undefined ? { endDate: new Date(payload.endDate) } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
      },
    });

    res.json({ term: updated });
  })
);

/**
 * Only planned terms can be removed. A term that has been active has been part
 * of real attendance, assessment and finance activity, so removing it would
 * orphan that history; completing it is the correct action instead.
 */
router.delete(
  '/:id/terms/:termId',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const term = await prisma.term.findUnique({ where: { id: req.params.termId } });
    if (!term || term.academicYearId !== req.params.id) {
      throw new ApiError(404, 'Term not found in this academic session');
    }
    if (term.status !== 'planned') {
      throw new ApiError(
        409,
        'Only a planned term can be removed. Complete it instead, so the activity recorded against it is preserved.'
      );
    }

    await prisma.term.delete({ where: { id: term.id } });
    res.status(204).send();
  })
);
