import { PrismaClient, InvitationStatus } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

export async function createInvitation(userId: string, invitedBy: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

  return prisma.invitation.create({
    data: {
      userId,
      token,
      invitedBy,
      expiresAt,
      status: "pending"
    }
  });
}

export async function getInvitationByToken(token: string) {
  return prisma.invitation.findUnique({
    where: { token },
    include: { user: true }
  });
}

export async function updateInvitationStatus(id: string, status: InvitationStatus, usedAt?: Date) {
  return prisma.invitation.update({
    where: { id },
    data: { status, usedAt }
  });
}

export async function listInvitations() {
  return prisma.invitation.findMany({
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" }
  });
}
