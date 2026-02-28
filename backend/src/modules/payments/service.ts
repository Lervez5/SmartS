import { CreateCheckoutInput, SubscriptionUpdateInput } from "./schema";
import {
  createOrUpdateSubscriptionRepo,
  createPaymentRepo,
  getSubscriptionForUser,
  listPaymentsForUser,
} from "./repository";

export async function createCheckoutService(userId: string, input: CreateCheckoutInput) {
  const providerRef = `mock-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const payment = await createPaymentRepo({
    userId,
    amountCents: input.amountCents,
    currency: input.currency.toUpperCase(),
    status: "succeeded",
    providerRef,
  });

  const subscription = await createOrUpdateSubscriptionRepo({
    userId,
    plan: input.plan,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { payment, subscription };
}

export function listMyPaymentsService(userId: string) {
  return listPaymentsForUser(userId);
}

export function mySubscriptionService(userId: string) {
  return getSubscriptionForUser(userId);
}

export function adminUpdateSubscriptionService(userId: string, input: SubscriptionUpdateInput) {
  return createOrUpdateSubscriptionRepo({
    userId,
    plan: input.plan,
    status: input.status,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}


