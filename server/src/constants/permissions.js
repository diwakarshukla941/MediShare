export const PERMISSIONS = [
  { key: "videos:view", label: "My Videos", description: "View, search, edit, download and delete uploaded videos" },
  { key: "videos:upload", label: "Upload Video", description: "Upload a single video" },
  { key: "videos:bulk_upload", label: "Bulk Upload", description: "Upload many videos at once via folder + CSV/Excel" },
  { key: "analytics:view", label: "Analytics", description: "View view/share analytics" },
  { key: "frames:manage", label: "Frame Studio", description: "Design and activate the branded video frame" },
  { key: "content_templates:manage", label: "Content Templates", description: "Manage the default/per-doctor title & description templates" },
  { key: "team:manage", label: "Team & Access", description: "Create/manage admin accounts and roles (can never see or grant Super Admin)" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// These can only ever be granted (via a Role's permission list, or an
// account's permissionOverrides.add) by an actual super_admin — regardless
// of whether the person doing the granting happens to hold them personally.
export const SUPER_ADMIN_ONLY_PERMISSIONS = ["frames:manage", "content_templates:manage"];
