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
    uploadIntentId: { type: String, unique: true, sparse: true },
    thumbnailUrl: { type: String, default: "" },
    imagekitFileId: { type: String, required: true },
    // Legacy name retained for existing records; holds the file key for the
    // provider recorded below.
    storageProvider: { type: String, default: "imagekit" },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    renderingStatus: { type: String, enum: ["processing", "completed", "failed"], default: "completed", index: true },
    renderingError: { type: String, default: "" },
    renderLeaseUntil: { type: Date, default: null, index: true },

    slug: { type: String, required: true, unique: true, index: true, default: () => nanoid(10) },

    // The original stays in sourceVideoUrl/sourceFileId so render jobs can
    // retry and metadata edits can produce a fresh framed file. videoUrl is
    // the current playback/export asset; frameBakedId identifies the frame
    // already present in its pixels. Replacing a frame never destroys the
    // source.
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
