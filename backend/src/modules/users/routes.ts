import { Router } from "express";
import {
  createUserController,
  deleteUserController,
  listUsersController,
  requireAdmin,
  updateUserController,
  updateMeController,
  updateMyPasswordController,
} from "./controller";

export const router = Router();

router.get("/", requireAdmin, (req, res, next) => {
  listUsersController(req, res).catch(next);
});

router.post("/", requireAdmin, (req, res, next) => {
  createUserController(req, res).catch(next);
});

router.put("/me", (req, res, next) => {
  updateMeController(req, res).catch(next);
});

router.put("/me/password", (req, res, next) => {
  updateMyPasswordController(req, res).catch(next);
});

router.put("/:id", requireAdmin, (req, res, next) => {
  updateUserController(req, res).catch(next);
});

router.delete("/:id", requireAdmin, (req, res, next) => {
  deleteUserController(req, res).catch(next);
});


