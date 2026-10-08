import { z } from 'zod';

export const validateInvitationSchema = z.object({
  token: z.string().min(1),
});

export const activateAccountSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export type ValidateInvitationInput = z.infer<typeof validateInvitationSchema>;
export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;
