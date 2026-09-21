export const AVAILABLE_VARIABLES = [
  { key: "doctorName", label: "Doctor Name" },
  { key: "credentials", label: "Credentials" },
  { key: "empId", label: "Employee ID" },
  { key: "title", label: "Video Title" },
  { key: "description", label: "Description" },
  { key: "zone", label: "Zone" },
  { key: "phone", label: "Phone" },
];

export function resolveVariables(content, video) {
  if (!content) return "";
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const value = video?.[key];
    return value !== undefined && value !== null && value !== "" ? String(value) : "";
  });
}
