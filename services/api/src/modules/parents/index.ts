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
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { recordAuditLog } from '../audit-logs/service';

export const router: Router = Router();

// Guardians belong to a school through their account's membership, and every
// read and write below is scoped by it. Without this a guardian in another
// school would be attachable, editable and listable here.
router.use(requireSchoolScope());

const listSchema = z.object({
  search: z.string().optional(),
  sort: z.enum(['name_asc', 'name_desc', 'newest', 'oldest']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const optionalName = z.string().trim().max(120).optional().or(z.literal(''));

const optionalPhone = z.string().trim().max(40).optional().or(z.literal(''));

/**
 * Creating a guardian, in the two shapes a school actually needs.
 *
 * `attach` marks an account that already exists as a guardian - what this route
 * has always done, and what the Add Parent page's "existing account" list is for.
 *
 * `create` provisions the account too, because a guardian usually arrives with
 * nothing but a name and a phone number: a school enrolling a new intake meets
 * its parents for the first time on enrolment day. Provisioning here is the same
 * work enrolment does for a learner - an account with the guardian role and a
 * school membership, left `pending` so activation is the invitation flow's job -
 * not a second identity.
 *
 * Exactly one of the two is accepted. Sending neither means there is nothing to
 * act on; sending both means the intent is ambiguous.
 */
const createSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    firstName: optionalName,
    lastName: optionalName,
    phone: optionalPhone,
  })
  .refine((value) => Boolean(value.userId) || Boolean(value.email), {
    message: "Provide either an existing account (userId) or the new guardian's email address.",
    path: ['email'],
  })
  .refine((value) => !(value.userId && value.email), {
    message: 'Give either an existing account or a new email address, not both.',
    path: ['email'],
  });

/**
 * Contact details, for a guardian already on record.
 *
 * The phone number is the field that matters most and the one with no way to set
 * it before this: the SMS Centre resolves recipients through it, so a guardian
 * without one is unreachable by the reminder workflow regardless of how many
 * learners they are linked to. It is validated for shape but stored as given,
 * since normalising to E.164 is the sending side's job and guessing a country
 * code here would silently rewrite what the school entered.
 */
const updateParentSchema = z.object({
  firstName: optionalName,
  lastName: optionalName,
  phone: optionalPhone,
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
  staffProfile: { select: { id: true, position: true, department: true, status: true } },
  roleMemberships: { select: { role: { select: { name: true, description: true } } } },
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
    staffProfile: {
      id: string;
      position: string | null;
      department: string | null;
      status: string;
    } | null;
    roleMemberships: Array<{ role: { name: string; description: string | null } }>;
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
    /*
     * A guardian account is frequently the same human as a member of staff or
     * an administrator. Surfacing that here is what lets the admissions screen
     * badge a "Dean" guardian without a second request for role data - and
     * without the UI hand-rolling a guess from the name.
     */
    isStaff: profile.user.staffProfile !== null,
    staff: profile.user.staffProfile
      ? {
          position: profile.user.staffProfile.position,
          department: profile.user.staffProfile.department,
          status: profile.user.staffProfile.status,
        }
      : null,
    roles: profile.user.roleMemberships
      .map((membership) => membership.role.name)
      .sort((a, b) => a.localeCompare(b)),
    childCount: profile.children.length,
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
 * Create a guardian, either by marking an existing account or by provisioning one.
 *
 * The two shapes share the outcome - a ParentProfile over an account that did not
 * have one - and differ only in whether the account already existed.
 */
router.post(
  '/',
  requirePermissions('parents.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id ?? null;

    const profile = await prisma.$transaction(async (tx) => {
      let userId = payload.userId;

      if (userId) {
        // Attaching to an account that exists. It must be one of the caller's,
        // so a guardian cannot be attached to a stranger's account.
        const member = await tx.user.findFirst({
          where: { id: userId, ...(schoolId ? { schoolMemberships: { some: { schoolId } } } : {}) },
          select: { id: true },
        });
        if (!member) {
          throw new ApiError(404, 'That account does not exist in your school.');
        }
      } else {
        const email = payload.email!.trim().toLowerCase();

        // An existing account with this email would be silently shaded into if
        // this were allowed, and the guardian would appear to be a new person
        // while their history stayed under the old account.
        const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
        if (existing) {
          throw new ApiError(
            409,
            'An account with that email already exists. Use the existing-account option to attach ' +
              'a guardian profile to it.'
          );
        }

        const guardianRole = await tx.role.findUnique({ where: { name: 'PARENT' } });

        const firstName = payload.firstName?.trim() || null;
        const lastName = payload.lastName?.trim() || null;

        const created = await tx.user.create({
          data: {
            email,
            firstName,
            lastName,
            // `name` is what every list and message shows, and it is derived
            // rather than left empty so a guardian with a typed name is not
            // rendered as blank email-only text.
            name: [firstName, lastName].filter(Boolean).join(' ') || null,
            phone: payload.phone?.trim() || null,
            // Pending, like every other provisioned account: activation belongs
            // to the invitation flow, which is what issues the credential.
            status: 'pending',
            // Without a membership the guardian belongs to no school, and every
            // school-scoped read would exclude them.
            ...(schoolId && guardianRole
              ? {
                  schoolMemberships: { create: { schoolId, isDefault: true } },
                  roleMemberships: { create: { roleId: guardianRole.id } },
                }
              : guardianRole
                ? { roleMemberships: { create: { roleId: guardianRole.id } } }
                : {}),
          },
          select: { id: true },
        });
        userId = created.id;
      }

      // A guardian already present on this account is a duplicate profile, not
      // an update: two profiles over one account would split the learner links.
      const alreadyGuardian = await tx.parentProfile.findUnique({ where: { userId } });
      if (alreadyGuardian) {
        throw new ApiError(409, 'That account is already a guardian');
      }

      return tx.parentProfile.create({
        data: { userId },
        include: { user: { select: userSelect }, children: { include: childInclude } },
      });
    });

    const contact = payload.phone?.trim();
    await recordAuditLog(
      actorId,
      payload.userId ? 'parents.attached' : 'parents.created',
      payload.userId
        ? `Guardian profile attached to account ${profile.user.email}.`
        : `Guardian ${profile.user.name || profile.user.email} created${contact ? ` with a contact number` : ''}. ` +
            `Activation is pending; no credential was issued here.`,
      schoolId
    );

    res.status(201).json({ parent: present(profile) });
  })
);

/**
 * Update a guardian's contact details.
 *
 * Scoped to the caller's school, so a guardian in another school reads as not
 * found rather than being editable.
 */
router.patch(
  '/:id',
  requirePermissions('parents.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = updateParentSchema.parse(req.body);
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id ?? null;

    const profile = await prisma.parentProfile.findFirst({
      where: {
        id: req.params.id,
        ...(schoolId ? { user: { schoolMemberships: { some: { schoolId } } } } : {}),
      },
      select: { id: true, user: { select: { id: true, email: true, phone: true } } },
    });
    if (!profile) throw new ApiError(404, 'Parent profile not found');

    // Contact fields live on the account, so they are written there and the
    // guardian's own record stays the link set.
    const account: Record<string, string | null> = {};
    if (payload.firstName !== undefined) account.firstName = payload.firstName.trim() || null;
    if (payload.lastName !== undefined) account.lastName = payload.lastName.trim() || null;
    if (payload.phone !== undefined) account.phone = payload.phone.trim() || null;

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(account).length > 0) {
        await tx.user.update({ where: { id: profile.user.id }, data: account });
      }
      return tx.parentProfile.findUniqueOrThrow({
        where: { id: profile.id },
        include: { user: { select: userSelect }, children: { include: childInclude } },
      });
    });

    await recordAuditLog(
      actorId,
      'parents.contact_updated',
      `Guardian contact details updated for ${profile.user.email}` +
        (payload.phone !== undefined
          ? ` (phone ${payload.phone?.trim() ? 'set' : 'cleared'})`
          : '') +
        '.',
      schoolId
    );

    res.json({ parent: present(updated) });
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
