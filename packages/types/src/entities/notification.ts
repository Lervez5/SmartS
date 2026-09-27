export type NotificationChannel = "email" | "sms" | "push" | "in_app";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface Notification {
  id: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  recipientId?: string | null;
  status: "pending" | "sent" | "delivered" | "failed";
  sentAt?: Date | null;
  createdAt: Date;
}
