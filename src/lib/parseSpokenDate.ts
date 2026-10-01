const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function defaultYear(ref: Date): number {
  return ref.getFullYear();
}

/** Parse voice/text dates: "10 October", "5 September 2004", "5.5.2026", "05/09/2026". Returns ISO yyyy-mm-dd. */
export function parseSpokenDate(
  raw: string,
  options?: { referenceDate?: Date }
): string | null {
  const ref = options?.referenceDate ?? new Date();
  let text = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[,]/g, " ")
    .replace(/\bof\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY (also single-digit parts)
  let m = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toIso(year, month, day);
  }

  // YYYY-MM-DD or YYYY/MM/DD with flexible separators
  m = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) {
    return toIso(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // "10 october 2026" / "10th october" / "october 10 2026"
  m = text.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{2,4}))?$/
  );
  if (m) {
    const day = Number(m[1]);
    const month = MONTHS[m[2]];
    if (!month) return null;
    let year = m[3] ? Number(m[3]) : defaultYear(ref);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toIso(year, month, day);
  }

  m = text.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{2,4}))?$/);
  if (m) {
    const month = MONTHS[m[1]];
    if (!month) return null;
    const day = Number(m[2]);
    let year = m[3] ? Number(m[3]) : defaultYear(ref);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toIso(year, month, day);
  }

  // Spoken with extra words: "my date of birth is 10 october 2005"
  m = text.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{2,4}))?/
  );
  if (m) {
    const day = Number(m[1]);
    const month = MONTHS[m[2]];
    if (!month) return null;
    let year = m[3] ? Number(m[3]) : defaultYear(ref);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toIso(year, month, day);
  }

  m = text.match(
    /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/
  );
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toIso(year, month, day);
  }

  return null;
}

export function formatIsoDateForDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
