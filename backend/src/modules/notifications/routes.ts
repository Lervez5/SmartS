import { Router } from "express";
import {
  createNotificationController,
  listMyNotificationsController,
  markNotificationReadController,
} from "./controller";

export const router = Router();

router.get("/me", (req, res, next) => {
  listMyNotificationsController(req, res).catch(next);
});

router.post("/", (req, res, next) => {
  createNotificationController(req, res).catch(next);
});

router.post("/:id/read", (req, res, next) => {
  markNotificationReadController(req, res).catch(next);
});


