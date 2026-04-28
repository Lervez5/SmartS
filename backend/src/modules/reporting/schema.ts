import { z } from "zod";

export const reportQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    format: z.enum(["json", "csv", "pdf"]).optional(),
  }),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
