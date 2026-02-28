import { z } from "zod";

export const gamificationEventSchema = z.object({
  studentId: z.string().uuid(),
  type: z.enum(["exercise_completed", "streak", "milestone"]),
  score: z.number().min(0).max(1),
});

export type GamificationEventInput = z.infer<typeof gamificationEventSchema>;


