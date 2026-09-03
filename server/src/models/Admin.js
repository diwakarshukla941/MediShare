import mongoose from "mongoose";
import { PERMISSION_KEYS } from "../constants/permissions.js";

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    location: { type: String, trim: true, default: "" },
    // super_admin always has full, unrestricted access and manages Team/Roles.
    // A plain "admin" account's access comes from its assigned role plus the
    // per-account overrides below (e.g. "HR role, minus Analytics, plus Frame Studio").
    role: { type: String, enum: ["admin", "super_admin"], default: "admin" },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: "Role", default: null },
    permissionOverrides: {
      add: [{ type: String, enum: PERMISSION_KEYS }],
      remove: [{ type: String, enum: PERMISSION_KEYS }],
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

export const Admin = mongoose.model("Admin", adminSchema);
