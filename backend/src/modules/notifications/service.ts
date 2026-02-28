import { CreateNotificationInput } from "./schema";
import {
  createNotificationRepo,
  listNotificationsForUser,
  markNotificationRead,
} from "./repository";

export function createNotificationService(input: CreateNotificationInput) {
  return createNotificationRepo(input.userId, input.title, input.body);
}

export function listMyNotificationsService(userId: string) {
  return listNotificationsForUser(userId);
}

export async function markNotificationReadService(userId: string, id: string) {
  await markNotificationRead(id, userId);
  return { success: true };
}


