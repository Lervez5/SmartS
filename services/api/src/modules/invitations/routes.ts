import { Router } from "express";
import {
  validateInvitationController,
  activateAccountController,
  listInvitationsController,
  createInvitationController,
  requireAdmin,
} from "./controller";

export const router: Router = Router();

router.get("/validate/:token", validateInvitationController);
router.post("/activate", activateAccountController);
router.get("/", requireAdmin, listInvitationsController);
router.post("/", requireAdmin, createInvitationController);
