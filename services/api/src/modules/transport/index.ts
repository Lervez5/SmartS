import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { resolveSchoolScope } from '../settings/scope';

/** Transport routes, backed by TransportRoute. */

const listSchema = z.object({ search: z.string().optional() });

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  startPoint: z.string().min(1).max(120),
  endPoint: z.string().min(1).max(120),
  stops: z.array(z.string().max(120)).default([]),
  fareCents: z.coerce.number().int().min(0).optional(),
});

export const router: Router = Router();

router.get(
  '/',
  requirePermissions('transport.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    const routes = await prisma.transportRoute.findMany({
      where: query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: 'asc' },
    });

    res.json({ routes });
  })
);

router.post(
  '/',
  requirePermissions('transport.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);

    const clash = await prisma.transportRoute.findUnique({
      where: { code: payload.code },
    });
    if (clash) throw new ApiError(409, 'A route with that code already exists');

    // Fares are recorded in the school's own currency.
    const scope = await resolveSchoolScope(req);
    const finance = await prisma.schoolFinanceSettings.findUnique({
      where: { schoolId: scope.schoolId },
    });

    const route = await prisma.transportRoute.create({
      data: {
        code: payload.code,
        name: payload.name,
        startPoint: payload.startPoint,
        endPoint: payload.endPoint,
        stops: payload.stops,
        fareCents: payload.fareCents,
        currency: finance?.currency ?? 'KES',
      },
    });

    res.status(201).json(route);
  })
);
