import crypto from 'node:crypto';
import { prisma } from '../../infrastructure/database';

export async function createInvitation(data: {
  email: string;
  roleId?: string;
  invitedBy?: string;
}) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return prisma.invitation.create({
    data: {
      email: data.email.toLowerCase(),
      roleId: data.roleId,
      token,
      expiresAt,
      invitedBy: data.invitedBy ?? undefined,
      status: 'pending',
    },
    include: { role: true },
  });
}

export async function getInvitationByToken(token: string) {
  return prisma.invitation.findUnique({
    where: { token },
    include: { role: true },
  });
}

export async function updateInvitationStatus(
  id: string,
  status: 'pending' | 'accepted' | 'expired',
  usedAt?: Date
) {
  return prisma.invitation.update({
    where: { id },
    data: {
      status,
      usedAt: usedAt || undefined,
    },
  });
}

export async function listInvitations() {
  return prisma.invitation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { role: true },
  });
}
