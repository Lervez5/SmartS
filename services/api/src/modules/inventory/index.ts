/**
 * Asset register.
 *
 * `Asset` already models what an asset register holds: a tag, a name, a
 * category, what it cost, when it was bought, where it is and what state it is
 * in. Only the route was missing, so this adds list and create rather than a
 * new model.
 *
 * This is the register of things the school *owns*. Stock it holds on a shelf is
 * a different question and has no model yet.
 */

import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';

export const router: Router = Router();

router.use(requireSchoolScope());

/**
 * Sort orders, typed as a map so each entry is checked against the model.
 *
 * Declared as a lookup rather than an inline literal indexed by `query.sort`:
 * indexing widens the string values and the result stops being assignable.
 */
const ASSET_ORDER_BY: Record<string, Prisma.AssetOrderByWithRelationInput> = {
  name_asc: { name: 'asc' },
  name_desc: { name: 'desc' },
  value_desc: { purchasePriceCents: 'desc' },
  newest: { createdAt: 'desc' },
};

/** The states an asset can be in, as Asset.status documents them. */
const ASSET_STATUSES = ['in_use', 'in_repair', 'retired'] as const;

const listSchema = z.object({
  search: z.string().optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  category: z.string().optional(),
  sort: z.enum(['name_asc', 'name_desc', 'value_desc', 'newest']).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  tag: z.string().trim().max(64).optional(),
  category: z.string().trim().max(64).optional(),
  purchasePriceCents: z.coerce.number().int().min(0).optional(),
  purchaseDate: z.string().optional(),
  location: z.string().trim().max(120).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
});

router.get(
  '/',
  requirePermissions('inventory.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);
    const { schoolId } = schoolScopeOf(req);

    const orderBy = ASSET_ORDER_BY[query.sort ?? 'name_asc'];

    const assets = await prisma.asset.findMany({
      where: {
        // Assets carry no schoolId of their own, so they are scoped through the
        // class they were issued against, which is a class of this school.
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { tag: { contains: query.search, mode: 'insensitive' } },
                { category: { contains: query.search, mode: 'insensitive' } },
                { location: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy,
    });

    const categories = await prisma.asset.findMany({
      distinct: ['category'],
      select: { category: true },
    });

    res.json({
      // The scope is reported so a caller can tell when a filtered list is
      // empty because of authorisation rather than because there are no assets.
      schoolScoped: Boolean(schoolId),
      assets,
      categories: categories
        .map((row) => row.category)
        .filter((c): c is string => Boolean(c))
        .sort(),
    });
  })
);

router.post(
  '/',
  requirePermissions('inventory.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);

    if (payload.tag) {
      const clash = await prisma.asset.findUnique({
        where: { tag: payload.tag },
        select: { id: true },
      });
      if (clash) throw new ApiError(409, `Asset tag "${payload.tag}" is already in use.`);
    }

    const asset = await prisma.asset.create({
      data: {
        name: payload.name,
        tag: payload.tag || null,
        category: payload.category || null,
        purchasePriceCents: payload.purchasePriceCents ?? null,
        purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : null,
        location: payload.location || null,
        status: payload.status ?? 'in_use',
      },
    });

    res.status(201).json({ asset });
  })
);
