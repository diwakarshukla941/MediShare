import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema(
  { name: { type: String, required: true, trim: true, unique: true } },
  { timestamps: true }
);

export const Zone = mongoose.model("Zone", zoneSchema);
