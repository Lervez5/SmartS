import { z } from 'zod';
import { StaffStatus, UserStatus } from '@prisma/client';

export const listStaffSchema = z.object({
  status: z.nativeEnum(StaffStatus).optional(),
  accountStatus: z.nativeEnum(UserStatus).optional(),
  role: z.string().optional(),
  search: z.string().optional(),
  sort: z
    .enum(['name_asc', 'name_desc', 'newest', 'oldest', 'hired_asc', 'hired_desc'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  include: z.string().optional(),
});

export const createStaffSchema = z.object({
  userId: z.string().min(1),
  position: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  employeeId: z.string().max(64).optional(),
  hireDate: z.string().optional(),
});

export const updateStaffSchema = z.object({
  position: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  status: z.nativeEnum(StaffStatus).optional(),
});

export type ListStaffInput = z.infer<typeof listStaffSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
