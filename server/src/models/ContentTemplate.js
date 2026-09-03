import mongoose from "mongoose";

const contentTemplateSchema = new mongoose.Schema(
  {
    // "all" = the fallback used when no doctor-specific template matches.
    // Exactly one "all" doc should ever exist (enforced via upsert in the
    // controller, not a unique index, since a plain boolean/enum can't be
    // partially-unique across a mixed collection).
    targetType: { type: String, enum: ["all", "doctor"], required: true },
    doctorEmail: { type: String, trim: true, lowercase: true, default: "" },
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

contentTemplateSchema.index(
  { doctorEmail: 1 },
  { unique: true, partialFilterExpression: { targetType: "doctor" } }
);

export const ContentTemplate = mongoose.model("ContentTemplate", contentTemplateSchema);

export async function getDefaultTemplate() {
  return ContentTemplate.findOne({ targetType: "all" });
}
