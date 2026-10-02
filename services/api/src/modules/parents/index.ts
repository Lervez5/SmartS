/**
 * Parent and guardian records.
 *
 * A guardian is three things kept deliberately separate:
 *  - the Central Auth `User`, which owns identity, sign-in and contact details
 *  - the `ParentProfile`, which marks that account as a guardian
 *  - the `ParentChildLink` rows, which say which learners it is linked to
 *
 * Nothing here creates a second identity: creating a guardian attaches a
 * profile to an existing account, exactly as enrolment attaches a learner
 * profile and Add Staff attaches a staff profile.
 *
 * `ParentChildLink` carries no relationship-type field, so there is no
 * mother/father/guardian label to return. Affiliation is reported as the linked
 * learners themselves, which is the relationship information the model actually
 * holds.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

export const router: Router = Router();

const listSchema = z.object({
  search: z.string().optional(),
  sort: z.enum(['name_asc', 'name_desc', 'newest', 'oldest']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z.object({
  userId: z.string().min(1),
});

const linkChildSchema = z.object({
  /** StudentProfile id, not the User id. */
  childId: z.string().min(1),
});

/** Contact fields live on the account, so they come through with the user. */
const userSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatar: true,
  status: true,
} as const;

const childInclude = {
  child: {
    select: {
      id: true,
      gradeLevel: true,
      user: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
    },
  },
} as const;

function present(profile: {
  id: string;
  userId: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    avatar: string | null;
    status: string;
  };
  children: Array<{
    id: string;
    child: {
      id: string;
      gradeLevel: string | null;
      user: {
        id: string;
        name: string | null;
        firstName: string | null;
        lastName: string | null;
        email: string;
      };
    };
  }>;
}) {
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.user.name,
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    email: profile.user.email,
    phone: profile.user.phone,
    avatar: profile.user.avatar,
    accountStatus: profile.user.status,
    createdAt: profile.createdAt,
    children: profile.children
      .map((link) => ({
        linkId: link.id,
        learnerId: link.child.id,
        name:
          link.child.user.name ??
          [link.child.user.firstName, link.child.user.lastName].filter(Boolean).join(' '),
        email: link.child.user.email,
        gradeLevel: link.child.gradeLevel,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

router.get(
  '/',
  requirePermissions('parents.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    const orderBy = {
      name_asc: { user: { name: 'asc' as const } },
      name_desc: { user: { name: 'desc' as const } },
      newest: { createdAt: 'desc' as const },
      oldest: { createdAt: 'asc' as const },
    }[query.sort ?? 'name_asc'];

    const profiles = await prisma.parentProfile.findMany({
      where: query.search
        ? {
            OR: [
              { user: { name: { contains: query.search, mode: 'insensitive' } } },
              { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
              { user: { phone: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: { user: { select: userSelect }, children: { include: childInclude } },
      orderBy,
      ...(query.limit ? { take: query.limit } : {}),
    });

    res.json({ parents: profiles.map(present) });
  })
);

router.get(
  '/:id',
  requirePermissions('parents.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await prisma.parentProfile.findUnique({
      where: { id: req.params.id },
      include: { user: { select: userSelect }, children: { include: childInclude } },
    });
    if (!profile) throw new ApiError(404, 'Parent profile not found');

    res.json({ parent: present(profile) });
  })
);

/**
 * Attach a guardian profile to an existing account.
 *
 * Accounts are provisioned separately, so this does not create a user; it marks
 * one as a guardian, which is what unlocks the Parent portal for it.
 */
router.post(
  '/',
  requirePermissions('parents.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new ApiError(404, 'User not found');

    const existing = await prisma.parentProfile.findUnique({ where: { userId: payload.userId } });
    if (existing) throw new ApiError(409, 'That account is already a guardian');

    const profile = await prisma.parentProfile.create({
      data: { userId: payload.userId },
      include: { user: { select: userSelect }, children: { include: childInclude } },
    });

    res.status(201).json({ parent: present(profile) });
  })
);

/**
 * Link a learner to a guardian.
 *
 * Takes a StudentProfile id because that is what ParentChildLink references;
 * the API validates it exists so a link can never point at nothing.
 */
router.post(
  '/:id/children',
  requirePermissions('parents.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = linkChildSchema.parse(req.body);

    const profile = await prisma.parentProfile.findUnique({ where: { id: req.params.id } });
    if (!profile) throw new ApiError(404, 'Parent profile not found');

    const learner = await prisma.studentProfile.findUnique({ where: { id: payload.childId } });
    if (!learner) throw new ApiError(404, 'Learner not found');

    const link = await prisma.parentChildLink.upsert({
      where: {
        parentId_childId: { parentId: profile.id, childId: learner.id },
      },
      update: {},
      create: { parentId: profile.id, childId: learner.id },
      include: childInclude,
    });

    res.status(201).json({ link });
  })
);

/**
 * Remove a guardian/learner link.
 *
 * Guarded on the link existing rather than the learner, so a learner removed
 * elsewhere does not block unlinking.
 */
router.delete(
  '/:id/children/:childId',
  requirePermissions('parents.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const link = await prisma.parentChildLink.findUnique({
      where: { id: req.params.childId, parentId: req.params.id },
    });
    if (!link) throw new ApiError(404, 'That learner is not linked to this guardian');

    await prisma.parentChildLink.delete({ where: { id: link.id } });
    res.status(204).send();
  })
);
