import { z } from "zod";

// What an uploader supplies (public page, dashboard single/bulk upload).
// title/description are deliberately absent — they're resolved server-side
// from ContentTemplate (see resolveContentTemplate.js), not typed per-video.
export const videoMetaSchema = z.object({
  doctorName: z.string().trim().min(2, "Doctor name is required"),
  degree: z.string().trim().min(2, "Degree is required (e.g. MBBS, BHMS)"),
  specialization: z.string().trim().optional().default(""),
  organizationName: z.string().trim().optional().default(""),
  phone: z.string().trim().min(1, "Phone number is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

// What the dashboard's Edit Video modal can change — everything above, plus
// title/description (still plain per-video fields, just not filled in at
// upload time anymore).
export const videoUpdateSchema = videoMetaSchema
  .extend({
    title: z.string().trim().optional(),
    description: z.string().trim().optional(),
  })
  .partial();
