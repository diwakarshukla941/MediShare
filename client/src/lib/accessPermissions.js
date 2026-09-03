// Mirrors server/src/constants/permissions.js — the definitive catalog still
// comes from GET /api/roles/permissions (server filters it to what the
// caller may grant); this is only used for labels/icons on the client.
export const PERMISSION_LABELS = {
  "videos:view": "My Videos",
  "videos:upload": "Upload Video",
  "videos:bulk_upload": "Bulk Upload",
  "analytics:view": "Analytics",
  "frames:manage": "Frame Studio",
  "content_templates:manage": "Content Templates",
  "team:manage": "Team & Access",
};

export function hasPermission(admin, key) {
  return admin?.role === "super_admin" || Boolean(admin?.permissions?.includes(key));
}
