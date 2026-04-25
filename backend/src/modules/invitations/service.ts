import { createInvitation, getInvitationByToken, updateInvitationStatus, listInvitations } from "./repository";
import { ApiError } from "../../shared/errorHandler";
import argon2 from "argon2";
import { updateUserRepo } from "../users/repository";

export async function createInvitationService(userId: string, adminId: string) {
  return createInvitation(userId, adminId);
}

export async function validateInvitationService(token: string) {
  const invitation = await getInvitationByToken(token);
  
  if (!invitation) {
    throw new ApiError(404, "Invalid invitation token");
  }

  if (invitation.status !== "pending") {
    throw new ApiError(400, `Invitation is already \${invitation.status}`);
  }

  if (new Date() > invitation.expiresAt) {
    await updateInvitationStatus(invitation.id, "expired");
    throw new ApiError(400, "Invitation has expired");
  }

  return invitation;
}

export async function activateAccountService(token: string, password: string) {
  const invitation = await validateInvitationService(token);

  const passwordHash = await argon2.hash(password);
  
  // Update user
  await updateUserRepo(invitation.userId, { 
    passwordHash,
    isActive: true 
  });

  // Mark invitation as used
  await updateInvitationStatus(invitation.id, "accepted", new Date());

  return { success: true };
}

export async function getInvitationListService() {
  return listInvitations();
}
