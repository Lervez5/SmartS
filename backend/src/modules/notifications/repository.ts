import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function createNotificationRepo(userId: string, title: string, body: string) {
  return prisma.notification.create({
    data: { userId, title, body },
  });
}

export function createManyNotificationsRepo(notifications: Array<{ userId: string; title: string; body: string }>) {
  return prisma.notification.createMany({
    data: notifications,
  });
}

export function listNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export function markNotificationRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}


