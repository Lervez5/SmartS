import { Router } from "express";
import { calendarController } from "./controller";

export const router = Router();

router.get("/today",    (req, res) => calendarController.getToday(req, res));
router.get("/events",   (req, res) => calendarController.getEvents(req, res));
router.post("/events",  (req, res) => calendarController.createEvent(req, res));
router.put("/events/:id",    (req, res) => calendarController.updateEvent(req, res));
router.delete("/events/:id", (req, res) => calendarController.deleteEvent(req, res));
