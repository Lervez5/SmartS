import { Router } from "express";
import { listAuditLogsController } from "./controller";
import { requireRole } from "../../middleware/rbac";

export const router: Router = Router();

const requireAdmin = requireRole("super_admin", "school_admin");

router.get("/", requireAdmin, (req, res, next) => {
  listAuditLogsController(req, res).catch(next);
});
