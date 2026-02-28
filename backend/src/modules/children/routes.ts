import { Router } from "express";
import {
  createChildController,
  listChildrenController,
  updateChildController,
} from "./controller";

export const router = Router();

router.get("/", (req, res, next) => {
  listChildrenController(req, res).catch(next);
});

router.post("/", (req, res, next) => {
  createChildController(req, res).catch(next);
});

router.put("/:id", (req, res, next) => {
  updateChildController(req, res).catch(next);
});


