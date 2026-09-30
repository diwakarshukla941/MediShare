import mongoose from "mongoose";

const bulkDownloadJobSchema = new mongoose.Schema({
  zone: { type: String, default: "all" },
  status: { type: String, enum: ["queued", "processing", "completed", "failed"], default: "queued", index: true },
  totalVideos: { type: Number, default: 0 },
  totalBytes: { type: Number, default: 0 },
  videoIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  processedVideos: { type: Number, default: 0 },
  archiveKey: { type: String, default: "" },
  archiveName: { type: String, required: true },
  error: { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  lockUntil: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

bulkDownloadJobSchema.index({ status: 1, lockUntil: 1 });

export const BulkDownloadJob = mongoose.model("BulkDownloadJob", bulkDownloadJobSchema);
