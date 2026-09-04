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

    // videoUrl is always the ONLY stored copy — no separate original +
    // rendered pair. Normally it's the raw upload: the watch page overlays
    // the active frame live (FrameRenderer), and downloads burn the frame
    // in on the fly and stream it straight to the browser without ever
    // saving that burned copy (see getFramedDownload). frameBakedId is set
    // only when a video has been permanently, deliberately locked to one
    // specific frame instead — either an older upload (from when frames
    // were burned in at upload time) or the super-admin-only "re-burn
    // existing videos" tool (frame.controller.js). In that case videoUrl
    // itself already has the frame burned in, so the watch page plays it
    // as-is and downloads just reuse the same file — a later frame change
    // does NOT retroactively touch it.
    frameBakedId: { type: mongoose.Schema.Types.ObjectId, ref: "Frame", default: null },

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
