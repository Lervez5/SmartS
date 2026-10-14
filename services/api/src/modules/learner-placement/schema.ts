import { z } from 'zod';

/**
 * Learner Placement and Stream Reorganization Schemas
 *
 * These schemas validate the placement reorganization workflow without
 * duplicating the existing Enrollment, Class, or Stream models.
 */

export const placementPreviewSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  streamIds: z.array(z.string().min(1)).min(1),
  /** Optional seed for reproducible random distribution */
  seed: z.number().int().optional(),
  /** Method: 'random' | 'balanced' */
  method: z.enum(['random', 'balanced']).default('balanced'),
  /** Whether to include currently unassigned learners (enrolled in class but no stream) */
  includeUnassigned: z.boolean().default(true),
});

export const placementProposalSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  /** Proposed assignments: learnerId -> streamId (or null for unassigned) */
  assignments: z.record(z.string().min(1), z.string().nullable()),
  /** Strategy used to generate this proposal */
  strategy: z.enum(['manual', 'random', 'balanced']),
  /** Optional seed for random strategy audit trail */
  seed: z.number().int().optional(),
  /** Administrative note/reason for the reorganization */
  reason: z.string().max(500).optional(),
});

export const confirmPlacementSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  assignments: z.record(z.string().min(1), z.string().nullable()),
  strategy: z.enum(['manual', 'random', 'balanced']),
  seed: z.number().int().optional(),
  reason: z.string().max(500).optional(),
});

export const streamCreateSchema = z.object({
  classId: z.string().min(1),
  academicYearId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(24),
  capacity: z.coerce.number().int().min(0).max(1000).optional(),
});

export const streamUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  code: z.string().trim().min(1).max(24).optional(),
  capacity: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

export const manualMoveSchema = z.object({
  learnerId: z.string().min(1),
  fromStreamId: z.string().nullable(),
  toStreamId: z.string().nullable(),
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
});

export const placementHistoryQuerySchema = z.object({
  academicYearId: z.string().optional(),
  classId: z.string().optional(),
  streamId: z.string().optional(),
  learnerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type PlacementPreviewInput = z.infer<typeof placementPreviewSchema>;
export type PlacementProposalInput = z.infer<typeof placementProposalSchema>;
export type ConfirmPlacementInput = z.infer<typeof confirmPlacementSchema>;
export type StreamCreateInput = z.infer<typeof streamCreateSchema>;
export type StreamUpdateInput = z.infer<typeof streamUpdateSchema>;
export type ManualMoveInput = z.infer<typeof manualMoveSchema>;
export type PlacementHistoryQuery = z.infer<typeof placementHistoryQuerySchema>;
