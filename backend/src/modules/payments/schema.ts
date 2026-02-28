import { z } from "zod";

export const createCheckoutSchema = z.object({
  plan: z.string().min(1),
  currency: z.string().length(3),
  amountCents: z.number().int().positive(),
});

export const subscriptionUpdateSchema = z.object({
  plan: z.string().min(1),
  status: z.enum(["active", "canceled", "past_due"]),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;


