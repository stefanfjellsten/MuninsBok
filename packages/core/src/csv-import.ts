/**
 * CSV bank statement parser for voucher import.
 *
 * Parses CSV text (semicolon or comma delimited) into structured rows
 * that can be mapped to voucher lines. Handles Swedish bank export
 * formats (SEB, Swedbank, Nordea, Handelsbanken, etc.).
 */

export interface CsvRow {
  /** Raw values keyed by column index */
  values: string[];
}

export interface ParsedCsvResult {
  /** Detected column headers (first row) */
  headers: string[];
  /** Data rows */
  rows: CsvRow[];
}

/**
 * A single imported bank transaction ready for voucher creation.
 */
export interface ImportedTransaction {
  /** Transaction date (ISO string) */
  date: string;
  /** Description / memo */
  description: string;
  /** Amount in öre (positive = income, negative = expense) */
  amount: number;
}

export interface CsvColumnMapping {
  /** Column index for date */
  dateColumn: number;
  /** Column index for description */
  descriptionColumn: number;
  /** Column index for amount */
  amountColumn: number;
}

export interface CsvImportError {
  row: number;
  message: string;
}

export interface CsvImportResult {
  transactions: ImportedTransaction[];
  errors: CsvImportError[];
  totalRows: number;
}

/**
 * Detect delimiter (semicolon or comma) by counting occurrences in first line.
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;

  if (tabs > semicolons && tabs > commas) return "\t";
  if (semicolons >= commas) return ";";
  return ",";
}

/**
 * Parse a single CSV field, handling quoted strings.
 */
function parseField(field: string): string {
  const trimmed = field.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

/**
 * Split a CSV line respecting quoted fields.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const char = line[i]!;

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(parseField(current));
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(parseField(current));
  return fields;
}

/**
 * Parse raw CSV text into headers + rows.
 */
export function parseCsv(text: string): ParsedCsvResult {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(text);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const headers = splitCsvLine(lines[0]!, delimiter);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const values = splitCsvLine(lines[i]!, delimiter);
    rows.push({ values });
  }

  return { headers, rows };
}

/**
 * Parse a Swedish-format date string into ISO date.
 * Handles: YYYY-MM-DD, YYYYMMDD, DD/MM/YYYY, DD.MM.YYYY
 */
function parseSwedishDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();

  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : trimmed;
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(trimmed)) {
    const iso = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : iso;
  }

  // DD/MM/YYYY or DD.MM.YYYY
  const match = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(trimmed);
  if (match) {
    const iso = `${match[3]}-${match[2]}-${match[1]}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : iso;
  }

  return null;
}

/**
 * Parse a Swedish-format amount string into öre.
 * Handles: "1 234,56", "-1234.56", "1234,56", etc.
 */
function parseSwedishAmount(amountStr: string): number | null {
  // Remove whitespace used as thousands separator
  let cleaned = amountStr.replace(/\s/g, "").trim();
  if (cleaned === "") return null;

  // Swedish format uses comma as decimal separator
  // If there's a comma, replace it with period
  // But first check if we have both comma and period (e.g., "1.234,56")
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // European format: dots are thousands, comma is decimal
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;

  return Math.round(parsed * 100);
}

/**
 * Apply column mapping to parsed CSV rows and produce transactions.
 */
export function mapCsvToTransactions(
  parsed: ParsedCsvResult,
  mapping: CsvColumnMapping,
): CsvImportResult {
  const transactions: ImportedTransaction[] = [];
  const errors: CsvImportError[] = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const row = parsed.rows[i]!;
    const rowNum = i + 2; // +2 for 1-indexed + header row

    const dateRaw = row.values[mapping.dateColumn] ?? "";
    const descRaw = row.values[mapping.descriptionColumn] ?? "";
    const amountRaw = row.values[mapping.amountColumn] ?? "";

    const date = parseSwedishDate(dateRaw);
    if (!date) {
      errors.push({ row: rowNum, message: `Ogiltigt datum: "${dateRaw}"` });
      continue;
    }

    const description = descRaw.trim();
    if (!description) {
      errors.push({ row: rowNum, message: "Beskrivning saknas" });
      continue;
    }

    const amount = parseSwedishAmount(amountRaw);
    if (amount === null) {
      errors.push({ row: rowNum, message: `Ogiltigt belopp: "${amountRaw}"` });
      continue;
    }

    if (amount === 0) {
      errors.push({ row: rowNum, message: "Beloppet är noll" });
      continue;
    }

    transactions.push({ date, description, amount });
  }

  return { transactions, errors, totalRows: parsed.rows.length };
}
