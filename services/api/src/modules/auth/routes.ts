import { Router } from 'express';
import {
  loginController,
  registerController,
  forgotPasswordController,
  resetPasswordController,
  logoutController,
  meController,
  refreshController,
  verifyResetTokenController,
  changePasswordController,
  revokeSessionsController,
} from './controller';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';

export const router: Router = Router();

router.post('/login', (req, res, next) => {
  loginController(req, res).catch(next);
});

router.get('/me', asyncHandler(meController));

// Renews an expired access token from the httpOnly refresh cookie.
router.post('/refresh', asyncHandler(refreshController));

// Public self-registration is not part of this platform. Accounts are
// provisioned by an authorized administrator through POST /users (and
// POST /users/bulk), which issues an invitation the user activates at
// /activate-account/[token]. This route is retained only as an
// administrator-initiated path and is permission-gated accordingly.
router.post('/register', requirePermissions('users.create'), (req, res, next) => {
  registerController(req, res).catch(next);
});

router.post('/forgot-password', (req, res, next) => {
  forgotPasswordController(req, res).catch(next);
});

router.post('/reset-password', (req, res, next) => {
  resetPasswordController(req, res).catch(next);
});

// Verifies a password reset token before showing the reset form.
// This is public because the user must be able to check their email link.
router.post('/verify-reset-token', (req, res, next) => {
  verifyResetTokenController(req, res);
});

// Authenticated: change current password. Requires the old password.
router.post('/change-password', asyncHandler(changePasswordController));

// Authenticated: revoke all sessions (log out everywhere).
router.post('/revoke-sessions', asyncHandler(revokeSessionsController));

router.post('/logout', (req, res) => {
  logoutController(req, res);
});
