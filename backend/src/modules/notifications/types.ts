export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: string;
  createdAt: Date;
}

export interface CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  type: string;
}
