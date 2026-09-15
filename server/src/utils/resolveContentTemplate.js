import { ContentTemplate } from "../models/ContentTemplate.js";

/**
 * Resolves the title/description for a newly-uploaded video from the global
 * default, otherwise blank (both fields stay optional).
 */
export async function resolveContentTemplate() {
  const defaultTemplate = await ContentTemplate.findOne({ targetType: "all" });
  if (defaultTemplate) {
    return { title: defaultTemplate.title, description: defaultTemplate.description };
  }

  return { title: "", description: "" };
}
