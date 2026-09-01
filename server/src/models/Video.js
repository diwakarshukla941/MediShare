import mongoose from "mongoose";
import { nanoid } from "nanoid";

const videoSchema = new mongoose.Schema(
  {
    doctorName: { type: String, required: true, trim: true },
    degree: { type: String, required: true, trim: true },
    specialization: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    organizationName: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },

    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },
    imagekitFileId: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },

    slug: { type: String, required: true, unique: true, index: true, default: () => nanoid(10) },

    // Frame rendering (async, via server/src/utils/renderQueue.js)
    renderedUrl: { type: String, default: "" },
    renderedImagekitFileId: { type: String, default: "" },
    renderingStatus: {
      type: String,
      enum: ["none", "pending", "processing", "completed", "failed"],
      default: "none",
    },
    renderingError: { type: String, default: "" },
    renderProgress: { type: Number, default: 0 },
    renderedFrameId: { type: mongoose.Schema.Types.ObjectId, ref: "Frame", default: null },
    renderedFrameVersion: { type: String, default: "" },

    views: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    source: { type: String, enum: ["public", "dashboard", "bulk"], default: "dashboard" },
  },
  { timestamps: true }
);

videoSchema.index({ doctorName: "text", title: "text", specialization: "text" });

export const Video = mongoose.model("Video", videoSchema);
