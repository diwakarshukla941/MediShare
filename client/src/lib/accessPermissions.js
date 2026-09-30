// Mirrors server/src/constants/permissions.js — the definitive catalog still
// comes from GET /api/roles/permissions (server filters it to what the
// caller may grant); this is only used for labels/icons on the client.
export const PERMISSION_LABELS = {
  "videos:view": "My Videos",
  "videos:upload": "Upload Video",
  "analytics:view": "Analytics",
  "frames:manage": "Frame Studio",
  "team:manage": "Team & Access",
};

export function hasPermission(admin, key) {
  return admin?.role === "super_admin" || Boolean(admin?.permissions?.includes(key));
}
