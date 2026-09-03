import mongoose from "mongoose";
import { PERMISSION_KEYS } from "../constants/permissions.js";

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    permissions: [{ type: String, enum: PERMISSION_KEYS }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

export const Role = mongoose.model("Role", roleSchema);
