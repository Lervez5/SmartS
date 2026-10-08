import { Router } from 'express';
import {
  validateInvitationController,
  activateAccountController,
  listInvitationsController,
  createInvitationController,
  requireAdmin,
} from './controller';
import { asyncHandler } from '../../shared/asyncHandler';

export const router: Router = Router();

router.get('/validate/:token', asyncHandler(validateInvitationController));
router.post('/activate', asyncHandler(activateAccountController));
router.get('/', requireAdmin, asyncHandler(listInvitationsController));
router.post('/', requireAdmin, asyncHandler(createInvitationController));
