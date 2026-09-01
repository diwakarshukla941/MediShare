import { z } from "zod";

export const videoMetaSchema = z.object({
  doctorName: z.string().trim().min(2, "Doctor name is required"),
  degree: z.string().trim().min(2, "Degree is required (e.g. MBBS, BHMS)"),
  specialization: z.string().trim().optional().default(""),
  designation: z.string().trim().optional().default(""),
  organizationName: z.string().trim().optional().default(""),
  title: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
});

export const videoUpdateSchema = videoMetaSchema.partial();
