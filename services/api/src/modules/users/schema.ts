import { z } from 'zod';
import { ROLES } from '@schoolos/auth/roles';

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(ROLES),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  avatar: z.string().max(1024).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(ROLES).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  avatar: z.string().max(1024).optional(),
  phone: z.string().max(32).optional(),
  status: z.enum(['pending', 'active', 'suspended', 'archived']).optional(),
});

export const updateMeSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().max(255).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  avatar: z.string().max(1024).optional(),
  phone: z.string().max(32).optional(),
});

export const updateMyPasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdateMyPasswordInput = z.infer<typeof updateMyPasswordSchema>;
