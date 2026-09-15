import Papa from "papaparse";

export type HiringImportRow = {
  full_name: string;
  email: string;
  phone: string;
  college_name: string;
  department: string;
};

const HEADER_ALIASES: Record<keyof HiringImportRow, string[]> = {
  full_name: ["full name", "name", "student name"],
  email: ["email", "email address"],
  phone: ["phone", "mobile", "contact number", "contact"],
  college_name: ["college", "college name"],
  department: ["department", "dept"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapRow(raw: Record<string, string>): HiringImportRow | null {
  const keys = Object.keys(raw);
  const lookup = new Map(keys.map((k) => [normalizeHeader(k), raw[k]?.trim() || ""]));

  const pick = (field: keyof HiringImportRow): string => {
    for (const alias of HEADER_ALIASES[field]) {
      const val = lookup.get(alias);
      if (val) return val;
    }
    return "";
  };

  const full_name = pick("full_name");
  if (full_name.length < 2) return null;

  return {
    full_name,
    email: pick("email"),
    phone: pick("phone"),
    college_name: pick("college_name"),
    department: pick("department"),
  };
}

export function parseHiringImportCsv(text: string): HiringImportRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message || "Could not parse CSV");
  }
  const rows: HiringImportRow[] = [];
  for (const row of parsed.data) {
    const mapped = mapRow(row);
    if (mapped) rows.push(mapped);
  }
  if (!rows.length) {
    throw new Error("No valid rows found. Required column: Full Name");
  }
  return rows;
}

export function parseHiringImportFile(file: File): Promise<HiringImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseHiringImportCsv(String(reader.result || "")));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });
}
