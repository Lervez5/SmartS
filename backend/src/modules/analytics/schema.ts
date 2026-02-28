import { z } from "zod";

export const progressQuerySchema = z.object({
  childId: z.string().uuid(),
});

export const systemStatsQuerySchema = z.object({});

export type ProgressQueryInput = z.infer<typeof progressQuerySchema>;


