import { PERMISSION_KEYS } from "../constants/permissions.js";

// Effective access = (assigned role's permissions) + overrides.add - overrides.remove.
// super_admin is unrestricted and bypasses this entirely (checked by callers).
export function computeEffectivePermissions(admin) {
  if (admin.role === "super_admin") return [...PERMISSION_KEYS];

  const set = new Set(admin.roleId?.permissions || []);
  for (const p of admin.permissionOverrides?.add || []) set.add(p);
  for (const p of admin.permissionOverrides?.remove || []) set.delete(p);
  return [...set];
}
