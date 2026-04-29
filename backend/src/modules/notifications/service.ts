import { CreateNotificationInput } from "./schema";
import {
  createNotificationRepo,
  createManyNotificationsRepo,
  listNotificationsForUser,
  markNotificationRead,
} from "./repository";

export function createNotificationService(input: CreateNotificationInput) {
  return createNotificationRepo(input.userId, input.title, input.body);
}

export function createManyNotificationsService(notifications: Array<{ userId: string; title: string; body: string }>) {
  return createManyNotificationsRepo(notifications);
}

export function listMyNotificationsService(userId: string) {
  return listNotificationsForUser(userId);
}

export async function markNotificationReadService(userId: string, id: string) {
  await markNotificationRead(id, userId);
  return { success: true };
}


