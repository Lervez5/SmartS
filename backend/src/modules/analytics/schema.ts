import { z } from "zod";

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectID");

export const progressQuerySchema = z.object({
  childId: objectIdSchema,
});

export const systemStatsQuerySchema = z.object({});

export type ProgressQueryInput = z.infer<typeof progressQuerySchema>;
