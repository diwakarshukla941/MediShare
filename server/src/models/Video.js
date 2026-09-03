import mongoose from "mongoose";
import { nanoid } from "nanoid";

const videoSchema = new mongoose.Schema(
  {
    doctorName: { type: String, required: true, trim: true },
    degree: { type: String, required: true, trim: true },
    specialization: { type: String, trim: true, default: "" },
    organizationName: { type: String, trim: true, default: "" },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    // Populated automatically at upload time from a ContentTemplate match
    // (by doctor email, falling back to the admin's default) — see
    // server/src/utils/resolveContentTemplate.js. Still a plain editable
    // field afterward (EditVideoModal can override per video).
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },

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

    // Who uploaded this video (blank for public, no-login uploads via the /upload link).
    // Name/email are a snapshot so attribution survives if the admin account is later removed.
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    uploadedByName: { type: String, trim: true, default: "" },
    uploadedByEmail: { type: String, trim: true, default: "" },
    uploadedByLocation: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

videoSchema.index({ doctorName: "text", title: "text", specialization: "text", email: "text" });

export const Video = mongoose.model("Video", videoSchema);
