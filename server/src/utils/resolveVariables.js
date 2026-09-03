export const AVAILABLE_VARIABLES = [
  { key: "doctorName", label: "Doctor Name" },
  { key: "degree", label: "Degree" },
  { key: "specialization", label: "Specialization" },
  { key: "title", label: "Video Title" },
  { key: "description", label: "Description" },
  { key: "organizationName", label: "Organization Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
];

export function resolveVariables(content, video) {
  if (!content) return "";
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const value = video?.[key];
    return value !== undefined && value !== null && value !== "" ? String(value) : "";
  });
}
