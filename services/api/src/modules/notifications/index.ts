import { Router, type Request, type Response } from 'express';
import { NotificationChannel, NotificationPriority } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { resolveSchoolScope } from '../settings/scope';

/**
 * Notifications.
 *
 * Delivery is governed by the school's notification settings, so a channel or
 * event switched off in Settings genuinely stops being sent rather than
 * toggling a switch with no consumer.
 */

const EVENT_SCHEMA = z.enum([
  'account_activation',
  'attendance',
  'fee_payment',
  'invoice_issued',
  'arrears_notice',
  'examination_results',
  'assignment',
  'announcement',
  'parent_communication',
]);

type EventKey = z.infer<typeof EVENT_SCHEMA>;

const listSchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
  event: EVENT_SCHEMA,
  title: z.string().min(1).max(160),
  body: z.string().max(2000).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  actionUrl: z.string().max(300).optional(),
});

/**
 * Which channels a school allows for an event, honouring the global switches.
 * The school comes from the caller's membership, resolved by the scope layer.
 */
async function channelsFor(req: Request, event: EventKey): Promise<NotificationChannel[]> {
  const scope = await resolveSchoolScope(req);

  const record = await prisma.schoolNotificationSettings.findUnique({
    where: { schoolId: scope.schoolId },
  });

  const globallyEnabled: NotificationChannel[] = [
    record?.emailEnabled === false ? null : 'email',
    record?.smsEnabled === false ? null : 'sms',
    record?.inAppEnabled === false ? null : 'in_app',
  ].filter(Boolean) as NotificationChannel[];

  let matrix: Record<string, string[]> = {};
  if (record?.eventMatrix) {
    try {
      matrix = JSON.parse(record.eventMatrix) as Record<string, string[]>;
    } catch {
      matrix = {};
    }
  }
  const allowed = (matrix[event] ?? []).map((c) => c as NotificationChannel);

  const resolved = allowed.length
    ? allowed.filter((c) => globallyEnabled.includes(c))
    : globallyEnabled.filter((c) => c === 'in_app');

  return resolved.length ? resolved : ['in_app'];
}

export const router: Router = Router();

/** The caller's notifications. */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);
    const where = {
      userId: req.user!.id,
      ...(query.unreadOnly ? { read: false } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
    };
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, read: false },
      }),
    ]);
    res.json({ notifications, unread });
  })
);

router.put(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!updated) throw new ApiError(404, 'Notification not found');

    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true, readAt: new Date() },
    });
    res.json(notification);
  })
);

router.put(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    res.json({ updated: result.count });
  })
);

/** Send a school event. The event's configured channels decide what is stored. */
router.post(
  '/send',
  requirePermissions('communications.send'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);
    const channels = await channelsFor(req, payload.event);

    const created = await prisma.notification.createMany({
      data: payload.userIds.flatMap((userId) =>
        channels.map((channel) => ({
          userId,
          title: payload.title,
          body: payload.body,
          channel,
          priority: payload.priority ?? NotificationPriority.medium,
          actionUrl: payload.actionUrl,
        }))
      ),
    });

    res.status(201).json({ delivered: created.count, channels });
  })
);

/** Effective settings for an event, so the UI can explain what will be sent. */
router.get(
  '/channels/:event',
  asyncHandler(async (req: Request, res: Response) => {
    const event = EVENT_SCHEMA.parse(req.params.event);
    res.json({ event, channels: await channelsFor(req, event) });
  })
);
