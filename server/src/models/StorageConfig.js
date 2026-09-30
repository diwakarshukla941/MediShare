import mongoose from "mongoose";

// The configuration is a singleton. `encryptedConfig` is AES-256-GCM data;
// credentials are never returned from the API or stored in plain text.
const storageConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: "primary", unique: true },
    provider: { type: String, enum: ["r2"], default: "r2" },
    encryptedConfig: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

export const StorageConfig = mongoose.model("StorageConfig", storageConfigSchema);
