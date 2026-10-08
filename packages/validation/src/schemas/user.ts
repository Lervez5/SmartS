import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["super_admin", "school_admin", "teacher", "parent", "student"]),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  avatar: z.string().max(1024).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(["super_admin", "school_admin", "teacher", "parent", "student"]).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  avatar: z.string().max(1024).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
