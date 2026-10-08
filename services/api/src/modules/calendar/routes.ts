import { Router } from "express";
import {
  listEventsController,
  todayEventsController,
  sessionsController,
  createEventController,
  updateEventController,
  deleteEventController,
} from "./controller";
import { requireRole } from "../../middleware/rbac";

export const router: Router = Router();

const requireStaff = requireRole("super_admin", "school_admin", "teacher");

router.get("/events", (req, res, next) => {
  listEventsController(req, res).catch(next);
});

router.get("/today", (req, res, next) => {
  todayEventsController(req, res).catch(next);
});

router.get("/sessions", requireStaff, (req, res, next) => {
  sessionsController(req, res).catch(next);
});

router.post("/events", (req, res, next) => {
  createEventController(req, res).catch(next);
});

router.put("/events/:id", (req, res, next) => {
  updateEventController(req, res).catch(next);
});

router.delete("/events/:id", (req, res, next) => {
  deleteEventController(req, res).catch(next);
});
