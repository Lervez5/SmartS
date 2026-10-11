import crypto from 'node:crypto';
import { prisma } from '../../infrastructure/database';

/**
 * A short, human-typeable activation code.
 *
 * The default UUID token is fine in an email link but is 36 characters of
 * punctuation - unusable on a basic phone, where the parent has to key it in by
 * hand on a numeric or alphanumeric keypad. This drops the ambiguous characters
 * (0/O, 1/I/L) that are misread on a small screen, and carries about 50 bits of
 * entropy in 10 characters.
 *
 * It is used as the invitation's token, so the existing activation route accepts
 * it unchanged - no second activation endpoint, and no second secret to keep in
 * step with this one.
 */
export function generateShortCode(length = 10): string {
  // Crockford-style alphabet without I, L, O and U: no two characters that are
  // commonly confused on a keypad or read aloud the same way.
  const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export async function createInvitation(data: {
  email: string;
  roleId?: string;
  invitedBy?: string;
  /** `uuid` for an email link, `short` for a code keyed in on a basic phone. */
  codeStyle?: 'uuid' | 'short';
  /** How long the invitation stays valid. Defaults to 7 days. */
  ttlMs?: number;
}) {
  const token = data.codeStyle === 'short' ? generateShortCode() : crypto.randomUUID();
  const expiresAt = new Date(Date.now() + (data.ttlMs ?? 7 * 24 * 60 * 60 * 1000));

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
