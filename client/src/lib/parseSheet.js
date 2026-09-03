import * as XLSX from "xlsx";

// Parses a .csv/.xlsx/.xls file into an array of row objects with lowercase, trimmed keys.
export async function parseSheetFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

  return rawRows.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase()] = typeof value === "string" ? value.trim() : value;
    }
    return normalized;
  });
}

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".webm"];

export function isVideoFile(file) {
  const name = file.name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
}
