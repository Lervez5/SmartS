import { ApiError } from '../../shared/logger';
import { config } from '../../config';
import { prisma } from '../../infrastructure/database';
import {
  createInvitation,
  getInvitationByToken,
  updateInvitationStatus,
  listInvitations,
} from './repository';
import { addEmailJob } from '../../infrastructure/queues';

export async function createInvitationService(data: {
  email: string;
  roleId?: string;
  invitedBy?: string;
}) {
  const invitation = await createInvitation(data);

  await addEmailJob(invitation.email, 'invitation', {
    to: invitation.email,
    role: invitation.role?.name,
    activationLink: `${config.urls.parent}/activate-account/${invitation.token}`,
  });

  return invitation;
}

export async function validateInvitationService(token: string) {
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    throw new ApiError(404, 'Invalid invitation token');
  }

  if (invitation.status !== 'pending') {
    throw new ApiError(400, `Invitation is already ${invitation.status}`);
  }

  if (new Date() > invitation.expiresAt) {
    await updateInvitationStatus(invitation.id, 'expired');
    throw new ApiError(400, 'Invitation has expired');
  }

  return invitation;
}

export async function activateAccountService(token: string, password: string) {
  const invitation = await validateInvitationService(token);

  const { default: argon2 } = await import('argon2');
  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email: invitation.email },
    update: {
      passwordHash,
      status: 'active',
    },
    create: {
      email: invitation.email,
      passwordHash,
      status: 'active',
      roleMemberships: invitation.role
        ? {
            create: {
              role: { connect: { id: invitation.role.id } },
            },
          }
        : undefined,
    },
  });

  await updateInvitationStatus(invitation.id, 'accepted', new Date());

  return { success: true };
}

export async function getInvitationListService() {
  return listInvitations();
}
