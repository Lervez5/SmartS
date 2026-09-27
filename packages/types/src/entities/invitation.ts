import type { Role } from "./user";

export type InvitationStatus = "pending" | "accepted" | "expired";

export interface Invitation {
  id: string;
  email: string;
  roleId?: string | null;
  role?: Role | null;
  token: string;
  status: InvitationStatus;
  invitedBy?: string | null;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}
