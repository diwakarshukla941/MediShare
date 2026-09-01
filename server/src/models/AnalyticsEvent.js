import mongoose from "mongoose";

const analyticsEventSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: "Video", required: true, index: true },
    eventType: { type: String, enum: ["view", "watch", "share"], required: true },
    sessionId: { type: String, default: "" },
    device: { type: String, enum: ["mobile", "tablet", "desktop", "other"], default: "other" },
    country: { type: String, default: "Unknown" },
    watchDuration: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ video: 1, eventType: 1, createdAt: -1 });

export const AnalyticsEvent = mongoose.model("AnalyticsEvent", analyticsEventSchema);
