import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { Role } from "../models/Role.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseSheetFile } from "../utils/parseSheetFile.js";
import { computeEffectivePermissions } from "../utils/computePermissions.js";
import { assertGrantable, assertCanTouchTarget, assertCanSetRole } from "../utils/permissionGuard.js";
import { createAdminSchema, updateAdminSchema } from "../validators/adminUser.validator.js";

function generatePassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

// Resolves the permission set a create/update call would actually grant
// (role's permissions + overrides.add), so it can be checked against the
// caller's own ceiling before anything is saved.
async function resolveGrantedPermissions({ roleId, permissionOverrides }) {
  const roleDoc = roleId ? await Role.findById(roleId).select("permissions") : null;
  const rolePerms = roleDoc?.permissions || [];
  const added = permissionOverrides?.add || [];
  return [...new Set([...rolePerms, ...added])];
}

function serializeAdmin(admin) {
  return {
    ...admin.toObject(),
    permissions: computeEffectivePermissions(admin),
  };
}

export const listAdmins = asyncHandler(async (req, res) => {
  const query = req.admin.role === "super_admin" ? {} : { role: { $ne: "super_admin" } };
  const admins = await Admin.find(query)
    .select("-passwordHash")
    .populate("createdBy", "name email")
    .populate("roleId", "name permissions")
    .sort({ createdAt: -1 });
  res.json({ admins: admins.map(serializeAdmin) });
});

export const createAdmin = asyncHandler(async (req, res) => {
  const data = createAdminSchema.parse(req.body);
  assertCanSetRole(req.admin, data.role);

  const existing = await Admin.findOne({ email: data.email });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const grantedPermissions = await resolveGrantedPermissions(data);
  assertGrantable(req.admin, grantedPermissions);

  const passwordHash = await bcrypt.hash(data.password, 12);
  const admin = await Admin.create({
    name: data.name,
    email: data.email,
    passwordHash,
    location: data.location,
    role: data.role,
    roleId: data.roleId || null,
    permissionOverrides: data.permissionOverrides,
    createdBy: req.admin._id,
  });

  res.status(201).json({
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, isActive: admin.isActive },
  });
});

export const bulkCreateAdmins = asyncHandler(async (req, res) => {
  const sheetFile = req.file;
  if (!sheetFile) {
    throw new ApiError(400, "A CSV or Excel file is required");
  }

  let rows;
  try {
    rows = parseSheetFile(sheetFile);
  } catch {
    throw new ApiError(400, "Could not parse the file. Please use the sample template.");
  }

  const created = [];
  const errors = [];

  for (const row of rows) {
    const email = String(row.email || "").trim().toLowerCase();
    const generatedPassword = row.password ? null : generatePassword();
    const requestedRole = row.role === "super_admin" ? "super_admin" : "admin";

    if (requestedRole === "super_admin" && req.admin.role !== "super_admin") {
      errors.push({ email: email || "(blank)", error: "Only a super admin can create a super admin" });
      continue;
    }

    const parsed = createAdminSchema.safeParse({
      name: row.name,
      email,
      password: row.password || generatedPassword,
      location: row.location || "",
      role: requestedRole,
    });

    if (!parsed.success) {
      errors.push({ email: email || "(blank)", error: parsed.error.issues.map((i) => i.message).join(", ") });
      continue;
    }

    const existing = await Admin.findOne({ email: parsed.data.email });
    if (existing) {
      errors.push({ email: parsed.data.email, error: "An account with this email already exists" });
      continue;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const admin = await Admin.create({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      location: parsed.data.location,
      role: parsed.data.role,
      createdBy: req.admin._id,
    });

    created.push({
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      // Only surfaced here, once, so the caller can share it — never stored in plaintext.
      generatedPassword,
    });
  }

  res.status(201).json({ created, errors, createdCount: created.length, errorCount: errors.length });
});

export const getSampleAdminSheet = asyncHandler(async (req, res) => {
  const csv = [
    "name,email,password,location,role",
    "Dr. Asha Rao,asha@medicare.example,,Mumbai,admin",
    "Front Desk Staff,frontdesk@medicare.example,Str0ngPass!,Bengaluru,admin",
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=medishare-team-sample.csv");
  res.send(csv);
});

export const updateAdmin = asyncHandler(async (req, res) => {
  const data = updateAdminSchema.parse(req.body);
  const target = await Admin.findById(req.params.id);
  if (!target) {
    throw new ApiError(404, "Account not found");
  }

  assertCanTouchTarget(req.admin, target);
  if (data.role) assertCanSetRole(req.admin, data.role);

  if ("roleId" in data || data.permissionOverrides) {
    const grantedPermissions = await resolveGrantedPermissions({
      roleId: "roleId" in data ? data.roleId : target.roleId,
      permissionOverrides: data.permissionOverrides,
    });
    assertGrantable(req.admin, grantedPermissions);
  }

  const isSelf = target._id.toString() === req.admin._id.toString();
  if (isSelf && (data.isActive === false || data.role === "admin")) {
    throw new ApiError(400, "You can't deactivate or demote your own account");
  }

  if ((data.role === "admin" || data.isActive === false) && target.role === "super_admin") {
    const activeSuperAdmins = await Admin.countDocuments({ role: "super_admin", isActive: true });
    if (activeSuperAdmins <= 1) {
      throw new ApiError(400, "At least one active super admin must remain");
    }
  }

  Object.assign(target, data);
  await target.save();

  res.json({
    admin: { id: target._id, name: target.name, email: target.email, role: target.role, isActive: target.isActive },
  });
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  const target = await Admin.findById(req.params.id);
  if (!target) {
    throw new ApiError(404, "Account not found");
  }

  assertCanTouchTarget(req.admin, target);

  if (target._id.toString() === req.admin._id.toString()) {
    throw new ApiError(400, "You can't delete your own account");
  }

  if (target.role === "super_admin") {
    const activeSuperAdmins = await Admin.countDocuments({ role: "super_admin", isActive: true });
    if (activeSuperAdmins <= 1) {
      throw new ApiError(400, "At least one active super admin must remain");
    }
  }

  await target.deleteOne();
  res.json({ message: "Account deleted" });
});
