import { Router } from "express";
import { activateAccountController, validateInvitationController, listInvitationsController } from "./controller";
import { requireRole } from "../../security/rbac";

export const router = Router();

// Public routes for account activation
router.get("/validate/:token", (req, res, next) => {
  validateInvitationController(req, res).catch(next);
});

router.post("/activate/:token", (req, res, next) => {
  activateAccountController(req, res).catch(next);
});

// Admin routes
router.get("/", requireRole(["super_admin", "school_admin"]), (req, res, next) => {
  listInvitationsController(req, res).catch(next);
});
