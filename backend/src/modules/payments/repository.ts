import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function createPaymentRepo(data: {
  userId: string;
  amountCents: number;
  currency: string;
  status: string;
  providerRef: string;
}) {
  return prisma.payment.create({ data });
}

export function createOrUpdateSubscriptionRepo(data: {
  userId: string;
  plan: string;
  status: string;
  currentPeriodEnd: Date;
}) {
  return prisma.subscription.upsert({
    where: { userId },
    update: {
      plan: data.plan,
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
    },
    create: data,
  });
}

export function listPaymentsForUser(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export function getSubscriptionForUser(userId: string) {
  return prisma.subscription.findUnique({ where: { userId } });
}


