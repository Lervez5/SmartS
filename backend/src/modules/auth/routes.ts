import { Router } from "express";
import {
  loginController,
  registerController,
  forgotPasswordController,
  resetPasswordController,
  logoutController
} from "./controller";

export const router = Router();

router.post("/login", (req, res, next) => {
  loginController(req, res).catch(next);
});

router.post("/register", (req, res, next) => {
  registerController(req, res).catch(next);
});

router.post("/forgot-password", (req, res, next) => {
  forgotPasswordController(req, res).catch(next);
});

router.post("/reset-password", (req, res, next) => {
  resetPasswordController(req, res).catch(next);
});

router.post("/logout", (req, res) => {
  logoutController(req, res);
});
