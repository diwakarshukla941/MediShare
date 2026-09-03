import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loginSchema, changePasswordSchema } from "../validators/auth.validator.js";
import { computeEffectivePermissions } from "../utils/computePermissions.js";

function signToken(admin) {
  return jwt.sign({ sub: admin._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const admin = await Admin.findOne({ email: email.toLowerCase() }).populate("roleId", "name permissions");
  if (!admin) {
    throw new ApiError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!admin.isActive) {
    throw new ApiError(401, "This account has been deactivated");
  }

  const token = signToken(admin);
  res.json({
    token,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      location: admin.location,
      role: admin.role,
      roleName: admin.roleId?.name || null,
      permissions: computeEffectivePermissions(admin),
    },
  });
});

export const me = asyncHandler(async (req, res) => {
  const { _id, name, email, location, role, roleId, permissions } = req.admin;
  res.json({ admin: { id: _id, name, email, location, role, roleName: roleId?.name || null, permissions } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const admin = await Admin.findById(req.admin._id);
  const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!valid) {
    throw new ApiError(400, "Current password is incorrect");
  }

  admin.passwordHash = await bcrypt.hash(newPassword, 12);
  await admin.save();

  res.json({ message: "Password updated successfully" });
});
