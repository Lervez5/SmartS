import { Router } from "express";
import { reminderController } from "./controller";

export const router = Router();

router.get("/",           (req, res) => reminderController.list(req, res));
router.get("/upcoming",   (req, res) => reminderController.upcoming(req, res));
router.post("/",          (req, res) => reminderController.create(req, res));
router.patch("/:id/done", (req, res) => reminderController.markDone(req, res));
router.patch("/:id/snooze",(req, res) => reminderController.snooze(req, res));
router.delete("/:id",     (req, res) => reminderController.remove(req, res));
