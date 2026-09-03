import { ApiError } from "./ApiError.js";
import { SUPER_ADMIN_ONLY_PERMISSIONS } from "../constants/permissions.js";

// Ensures `requester` is allowed to grant every permission key in `keys` to
// someone else — via a Role's permission list, or an account's
// permissionOverrides.add. A delegated (non-super) team manager can only
// grant permissions they hold themselves ("equivalent or lower"), and can
// never grant Frame Studio / Content Templates access at all, no matter
// what they hold — that stays exclusively a super admin's call.
export function assertGrantable(requester, keys = []) {
  if (requester.role === "super_admin") return;
  for (const key of keys) {
    if (SUPER_ADMIN_ONLY_PERMISSIONS.includes(key)) {
      throw new ApiError(403, "Only a super admin can grant access to Frame Studio or Content Templates");
    }
    if (!requester.permissions?.includes(key)) {
      throw new ApiError(403, `You can't grant "${key}" — you don't have that access yourself`);
    }
  }
}

// Blocks a non-super-admin from viewing or modifying a super admin account.
export function assertCanTouchTarget(requester, target) {
  if (requester.role === "super_admin") return;
  if (target.role === "super_admin") {
    throw new ApiError(403, "Not allowed to view or modify a super admin account");
  }
}

// Blocks a non-super-admin from creating/promoting anyone to super_admin.
export function assertCanSetRole(requester, role) {
  if (role === "super_admin" && requester.role !== "super_admin") {
    throw new ApiError(403, "Only a super admin can create or promote another super admin");
  }
}
