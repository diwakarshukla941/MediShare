import { Role } from "../models/Role.js";
import { Admin } from "../models/Admin.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PERMISSIONS, SUPER_ADMIN_ONLY_PERMISSIONS } from "../constants/permissions.js";
import { assertGrantable } from "../utils/permissionGuard.js";
import { createRoleSchema, updateRoleSchema } from "../validators/role.validator.js";

// Only ever shows what the requester is themselves allowed to grant —
// a delegated (non-super) team manager never even sees Frame Studio /
// Content Templates as options, and only sees permissions they hold.
export const listPermissions = asyncHandler(async (req, res) => {
  if (req.admin.role === "super_admin") {
    return res.json({ permissions: PERMISSIONS });
  }
  const grantable = PERMISSIONS.filter(
    (p) => !SUPER_ADMIN_ONLY_PERMISSIONS.includes(p.key) && req.admin.permissions?.includes(p.key)
  );
  res.json({ permissions: grantable });
});

export const listRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find().sort({ createdAt: -1 });
  const counts = await Admin.aggregate([
    { $match: { roleId: { $ne: null } } },
    { $group: { _id: "$roleId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
  res.json({
    roles: roles.map((r) => ({ ...r.toObject(), assignedCount: countMap.get(r._id.toString()) || 0 })),
  });
});

export const createRole = asyncHandler(async (req, res) => {
  const data = createRoleSchema.parse(req.body);
  assertGrantable(req.admin, data.permissions);

  const existing = await Role.findOne({ name: data.name });
  if (existing) {
    throw new ApiError(409, "A role with this name already exists");
  }
  const role = await Role.create({ ...data, createdBy: req.admin._id });
  res.status(201).json({ role });
});

export const updateRole = asyncHandler(async (req, res) => {
  const data = updateRoleSchema.parse(req.body);
  if (data.permissions) assertGrantable(req.admin, data.permissions);

  const role = await Role.findById(req.params.id);
  if (!role) {
    throw new ApiError(404, "Role not found");
  }
  Object.assign(role, data);
  await role.save();
  res.json({ role });
});

export const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    throw new ApiError(404, "Role not found");
  }
  assertGrantable(req.admin, role.permissions);

  const inUse = await Admin.countDocuments({ roleId: role._id });
  if (inUse > 0 && req.query.confirm !== "true") {
    throw new ApiError(409, `This role is assigned to ${inUse} account(s). Pass ?confirm=true to delete anyway.`);
  }
  if (inUse > 0) {
    await Admin.updateMany({ roleId: role._id }, { $set: { roleId: null } });
  }
  await role.deleteOne();
  res.json({ message: "Role deleted" });
});
