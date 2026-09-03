import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Admin } from "../models/Admin.js";
import { computeEffectivePermissions } from "../utils/computePermissions.js";

const ADMIN_SELECT = "_id name email location role isActive roleId permissionOverrides";

function attachPermissions(admin) {
  admin.permissions = computeEffectivePermissions(admin);
  return admin;
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  const admin = await Admin.findById(payload.sub).select(ADMIN_SELECT).populate("roleId", "name permissions");
  if (!admin) {
    throw new ApiError(401, "Account no longer exists");
  }
  if (!admin.isActive) {
    throw new ApiError(401, "This account has been deactivated");
  }

  req.admin = attachPermissions(admin);
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(payload.sub).select(ADMIN_SELECT).populate("roleId", "name permissions");
    if (admin && admin.isActive) req.admin = attachPermissions(admin);
  } catch {
    // invalid/expired token on an otherwise-public route: proceed unauthenticated
  }

  next();
});

export const requireSuperAdmin = asyncHandler(async (req, res, next) => {
  if (req.admin?.role !== "super_admin") {
    throw new ApiError(403, "Super admin access required");
  }
  next();
});

// Gate a route behind a specific permission key. super_admin always passes.
// Use after requireAuth. For routes an unauthenticated public user may also
// hit (optionalAuth), only enforce the check when someone is actually logged in.
export const requirePermission = (key) => (req, res, next) => {
  if (!req.admin) return next();
  if (req.admin.role === "super_admin" || req.admin.permissions?.includes(key)) {
    return next();
  }
  throw new ApiError(403, "You don't have access to this feature");
};
