import mongoose from "mongoose";
import { nanoid } from "nanoid";

const videoSchema = new mongoose.Schema(
  {
    doctorName: { type: String, required: true, trim: true },
    credentials: { type: String, required: true, trim: true },
    empId: { type: String, required: true, trim: true },
    zone: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    // Populated automatically at upload time from the global ContentTemplate.
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },

    videoUrl: { type: String, required: true },
    // Original source is retained so metadata changes can create a new baked
    // file without asking the uploader to submit the video again.
    sourceVideoUrl: { type: String, default: "" },
    sourceFileId: { type: String, default: "" },
    sourceStorageProvider: { type: String, default: "imagekit" },
    thumbnailUrl: { type: String, default: "" },
    imagekitFileId: { type: String, required: true },
    // Legacy name retained for existing records; holds the file key for the
    // provider recorded below.
    storageProvider: { type: String, default: "imagekit" },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    renderingStatus: { type: String, enum: ["processing", "completed", "failed"], default: "processing", index: true },
    renderingError: { type: String, default: "" },

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

    // A one-time-rendered, reusable copy for downloads of an UNBAKED video
    // (frameBakedId null) — the first download for a given video+frame pair
    // burns and uploads it, every download after that just redirects here
    // instantly instead of re-burning. cachedRenderFrameVersion is
    // `${frame._id}-${frame.updatedAt}` (see frameVersion() in
    // composeFramedVideo.js); a mismatch (frame activated/edited since, or
    // never rendered) means the cache is stale and getFramedDownload
    // re-renders. Also cleared whenever the video's own fields change
    // (updateVideo) since those can feed {{variables}} in the frame.
    cachedRenderUrl: { type: String, default: "" },
    cachedRenderImagekitFileId: { type: String, default: "" },
    cachedRenderFrameVersion: { type: String, default: "" },

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
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, value) => {
        delete value.email;
        return value;
      },
    },
  }
);

videoSchema.index({ doctorName: "text", empId: "text", zone: "text" });

export const Video = mongoose.model("Video", videoSchema);
