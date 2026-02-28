import { Router } from "express";
import { authMiddleware } from "./security/auth";
import { router as authRouter } from "./modules/auth";
import { router as routerGamification } from "./modules/gamification";
import { router as routerUsers } from "./modules/users";
import { router as routerChildren } from "./modules/children";
import { router as routerSubjects } from "./modules/subjects";
import { router as routerAnalytics } from "./modules/analytics";
import { router as routerNotifications } from "./modules/notifications";
import { router as routerPayments } from "./modules/payments";
import { router as routerAuditLogs } from "./modules/audit-logs";
import { router as routerAiConnector } from "./modules/ai-engine-connector";
import { router as uploadRouter } from "./modules/upload";

export const router = Router();

router.use(authMiddleware);

router.use("/auth", authRouter);
router.use("/gamification", routerGamification);
router.use("/users", routerUsers);
router.use("/children", routerChildren);
router.use("/subjects", routerSubjects);
router.use("/analytics", routerAnalytics);
router.use("/notifications", routerNotifications);
router.use("/payments", routerPayments);
router.use("/audit-logs", routerAuditLogs);
router.use("/ai", routerAiConnector);
router.use("/upload", uploadRouter);


