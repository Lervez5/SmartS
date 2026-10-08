/**
 * Shared validation schemas using zod.
 * Re-exported from the canonical schema module.
 */

import { z } from 'zod';

// Re-export common schemas used across the platform
export const EmailSchema = z.string().email().max(255);
export const PasswordSchema = z.string().min(8).max(128);
export const NameSchema = z.string().min(2).max(100);

export const LoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const InvitationSchema = z.object({
  email: EmailSchema,
  role: z.enum(['SUPER_ADMIN', 'ACCOUNTANT', 'DEAN', 'TEACHER', 'PARENT', 'STUDENT']),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

export type InvitationInput = z.infer<typeof InvitationSchema>;

export { z };
