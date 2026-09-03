import { ContentTemplate } from "../models/ContentTemplate.js";

/**
 * Resolves the title/description for a newly-uploaded video: a doctor-specific
 * override (matched by email) wins if one exists, otherwise the admin's
 * single "for all" default, otherwise blank (both fields stay optional).
 */
export async function resolveContentTemplate(doctorEmail) {
  const email = (doctorEmail || "").trim().toLowerCase();

  const doctorTemplate = email ? await ContentTemplate.findOne({ targetType: "doctor", doctorEmail: email }) : null;
  if (doctorTemplate) {
    return { title: doctorTemplate.title, description: doctorTemplate.description };
  }

  const defaultTemplate = await ContentTemplate.findOne({ targetType: "all" });
  if (defaultTemplate) {
    return { title: defaultTemplate.title, description: defaultTemplate.description };
  }

  return { title: "", description: "" };
}
