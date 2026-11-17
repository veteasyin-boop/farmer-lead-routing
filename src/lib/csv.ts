/** Small RFC-4180-style parser; supports quoted commas/newlines and escaped quotes. */
export function csvRecords(input: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV में बंद quotation mark नहीं मिला।");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => value.trim().replace(/^\uFEFF/, "").toLowerCase());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new Error("CSV headers खाली या duplicate नहीं होने चाहिए।");
  }

  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => { record[header] = (cells[index] ?? "").trim(); });
    return record;
  });
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const escape = (value: unknown): string => {
    const raw = value == null ? "" : String(value);
    // Prevent spreadsheet formula execution when an exported CSV is opened in Excel/Sheets.
    const text = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.map(escape).join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\r\n");
}
