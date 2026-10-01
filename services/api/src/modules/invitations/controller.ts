import { Request, Response } from 'express';
import { validateInvitationSchema, activateAccountSchema } from './schema';
import {
  validateInvitationService,
  activateAccountService,
  getInvitationListService,
  createInvitationService,
} from './service';
import { requireRole, requirePermissions } from '../../middleware/rbac';

export const requireAdmin = requirePermissions('users.create');

export async function validateInvitationController(req: Request, res: Response) {
  const parsed = validateInvitationSchema.parse(req.params);
  const invitation = await validateInvitationService(parsed.token);
  res.json({ invitation });
}

export async function activateAccountController(req: Request, res: Response) {
  const parsed = activateAccountSchema.parse(req.body);
  await activateAccountService(parsed.token, parsed.password);
  res.json({ message: 'Account activated successfully' });
}

export async function listInvitationsController(_req: Request, res: Response) {
  const invitations = await getInvitationListService();
  res.json({ invitations });
}

export async function createInvitationController(req: Request, res: Response) {
  const result = await createInvitationService({
    email: req.body.email,
    roleId: req.body.roleId,
    invitedBy: req.user!.id,
  });
  res.status(201).json({ invitation: result });
}
