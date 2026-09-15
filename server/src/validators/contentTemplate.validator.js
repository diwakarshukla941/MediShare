import { z } from "zod";

export const defaultTemplateSchema = z.object({
  title: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
});
