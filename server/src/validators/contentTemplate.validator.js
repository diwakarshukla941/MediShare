import { z } from "zod";

export const defaultTemplateSchema = z.object({
  title: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
});

export const doctorTemplateSchema = defaultTemplateSchema.extend({
  doctorEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const doctorTemplateUpdateSchema = doctorTemplateSchema.partial();
