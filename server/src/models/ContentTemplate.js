import mongoose from "mongoose";

const contentTemplateSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["all"], required: true },
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export const ContentTemplate = mongoose.model("ContentTemplate", contentTemplateSchema);

export async function getDefaultTemplate() {
  return ContentTemplate.findOne({ targetType: "all" });
}
