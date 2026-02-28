import { Router } from "express";
import { listAuditLogsController } from "./controller";

export const router = Router();

router.get("/", (req, res, next) => {
  listAuditLogsController(req, res).catch(next);
});


