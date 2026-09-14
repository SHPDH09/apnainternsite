/** Central normalization for student unique fields — use everywhere before compare or persist. */

const EMPTY_ROLL_VALUES = new Set(["", "—", "-", "na", "n/a", "none", "null"]);

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(raw: unknown): boolean {
  const email = normalizeEmail(raw);
  return email.includes("@") && email.includes(".") && email.length >= 5;
}

export function normalizePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function isValidPhone(raw: unknown): boolean {
  return normalizePhone(raw).length === 10;
}

export function normalizeRollNumber(raw: unknown): string {
  const v = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (EMPTY_ROLL_VALUES.has(v)) return "";
  return v;
}

export function normalizeRegistrationNumber(raw: unknown): string {
  return normalizeRollNumber(raw);
}

export function normalizeUniversityKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isPortalRegistrationId(raw: unknown): boolean {
  return /^EZY\//i.test(String(raw ?? "").trim());
}

export function universityRollCompositeKey(
  university: unknown,
  rollNumber: unknown
): string {
  const uni = normalizeUniversityKey(university);
  const roll = normalizeRollNumber(rollNumber);
  if (!uni || !roll) return "";
  return `${uni}|${roll}`;
}

export function universityRegistrationCompositeKey(
  university: unknown,
  registrationNumber: unknown
): string {
  const uni = normalizeUniversityKey(university);
  const reg = normalizeRegistrationNumber(registrationNumber);
  if (!uni || !reg || isPortalRegistrationId(reg)) return "";
  return `${uni}|${reg}`;
}
