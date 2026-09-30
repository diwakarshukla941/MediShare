export const PERMISSIONS = [
  { key: "videos:view", label: "My Videos", description: "View, search, edit, download and delete uploaded videos" },
  { key: "videos:upload", label: "Upload Video", description: "Upload a single video" },
  { key: "videos:bulk_upload", label: "Legacy Bulk Upload", description: "No longer grants access" },
  { key: "analytics:view", label: "Analytics", description: "View view/share analytics" },
  { key: "frames:manage", label: "Frame Studio", description: "Design and activate the branded video frame" },
  { key: "team:manage", label: "Team & Access", description: "Create/manage admin accounts and roles (can never see or grant Super Admin)" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// These can only ever be granted (via a Role's permission list, or an
// account's permissionOverrides.add) by an actual super_admin — regardless
// of whether the person doing the granting happens to hold them personally.
export const SUPER_ADMIN_ONLY_PERMISSIONS = ["videos:bulk_upload", "frames:manage"];
