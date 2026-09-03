import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

// Parses a .csv/.xlsx/.xls multer file buffer into row objects with lowercase, trimmed keys.
export function parseSheetFile(sheetFile) {
  const name = sheetFile.originalname.toLowerCase();
  if (name.endsWith(".csv")) {
    return parse(sheetFile.buffer.toString("utf-8"), {
      columns: (header) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    });
  }

  const workbook = XLSX.read(sheetFile.buffer, { type: "buffer" });
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
