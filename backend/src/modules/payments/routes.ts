import { Router } from "express";
import {
  adminUpdateSubscriptionController,
  createCheckoutController,
  listMyPaymentsController,
  mySubscriptionController,
} from "./controller";

export const router = Router();

router.post("/checkout", (req, res, next) => {
  createCheckoutController(req, res).catch(next);
});

router.get("/me", (req, res, next) => {
  listMyPaymentsController(req, res).catch(next);
});

router.get("/me/subscription", (req, res, next) => {
  mySubscriptionController(req, res).catch(next);
});

router.put("/admin/subscription/:userId", (req, res, next) => {
  adminUpdateSubscriptionController(req, res).catch(next);
});


