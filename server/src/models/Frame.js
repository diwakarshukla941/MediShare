import mongoose from "mongoose";

const frameSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    aspectRatio: { type: String, default: "custom" },
    background: {
      type: { type: String, enum: ["color", "image"], default: "color" },
      value: { type: String, default: "#eef2ff" },
      fileId: { type: String, default: "" },
    },
    // Element shape varies by type (text/image/video/rect/circle/line) — validated
    // at the API boundary via zod (server/src/validators/frame.validator.js), not here.
    elements: { type: [mongoose.Schema.Types.Mixed], default: [] },
    isActive: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Frame = mongoose.model("Frame", frameSchema);

export async function getActiveFrame() {
  return Frame.findOne({ isActive: true });
}
