import { studentMetadataOf } from "@/lib/studentProfileDisplay";

function fmtInternshipDisplayDate(iso: string): string {
  try {
    const d = parseIsoDateLocal(iso);
    if (!d) return "—";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "—";
  }
}

/** Inclusive calendar days in the registration-based internship window (same as LNMU 1–20 June). */
export const REGISTRATION_INTERNSHIP_PROGRAMME_DAYS = 20;

export type RegistrationInternshipDates = {
  joiningIso: string;
  completionIso: string;
  startDisplay: string;
  endDisplay: string;
  period: string;
  programmeStartDate: Date;
  programmeDayCount: number;
};

function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function localDateFromTimestamp(ts: string): Date | null {
  const parsed = Date.parse(ts);
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toInternshipIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function completionDateFromInternshipStart(start: Date): Date {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  end.setDate(end.getDate() + REGISTRATION_INTERNSHIP_PROGRAMME_DAYS - 1);
  return end;
}

/** Registration day (or stored joining_date) anchors start; completion is +19 days (20 inclusive). */
export function resolveRegistrationInternshipAnchor(
  profile: Record<string, unknown> | null | undefined
): Date | null {
  if (!profile) return null;
  const m = studentMetadataOf(profile);
  const joiningRaw = String(profile.joining_date || m.joining_date || "").trim();
  const fromJoining = parseIsoDateLocal(joiningRaw);
  if (fromJoining) return fromJoining;

  for (const key of ["created_at", "application_date", "applied_at"] as const) {
    const raw = String(profile[key] || m[key] || "").trim();
    if (!raw) continue;
    const fromTs = localDateFromTimestamp(raw);
    if (fromTs) return fromTs;
  }
  return null;
}

export function computeRegistrationInternshipDates(anchor: Date): RegistrationInternshipDates {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const end = completionDateFromInternshipStart(start);
  const joiningIso = toInternshipIsoDateLocal(start);
  const completionIso = toInternshipIsoDateLocal(end);
  const startDisplay = fmtInternshipDisplayDate(joiningIso);
  const endDisplay = fmtInternshipDisplayDate(completionIso);
  return {
    joiningIso,
    completionIso,
    startDisplay,
    endDisplay,
    period: `${startDisplay} - ${endDisplay}`,
    programmeStartDate: start,
    programmeDayCount: REGISTRATION_INTERNSHIP_PROGRAMME_DAYS,
  };
}

export function resolveRegistrationInternshipDates(
  profile: Record<string, unknown> | null | undefined
): RegistrationInternshipDates | null {
  const anchor = resolveRegistrationInternshipAnchor(profile);
  if (!anchor) return null;
  return computeRegistrationInternshipDates(anchor);
}

/** New registration rows: same calendar day for start, joining, and internship start. */
export function registrationInternshipDatesForToday(now = new Date()): RegistrationInternshipDates {
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return computeRegistrationInternshipDates(anchor);
}

/** Fill missing joining/completion on profile + metadata from registration timestamp. */
export function applyRegistrationInternshipDatesToProfile<T extends Record<string, unknown>>(
  profile: T
): T {
  const computed = resolveRegistrationInternshipDates(profile);
  if (!computed) return profile;

  const m = studentMetadataOf(profile);
  const joining = String(profile.joining_date || m.joining_date || "").trim();
  const completion = String(profile.completion_date || m.completion_date || "").trim();

  const joiningIso = joining && parseIsoDateLocal(joining) ? joining.slice(0, 10) : computed.joiningIso;
  const completionIso =
    completion && parseIsoDateLocal(completion) ? completion.slice(0, 10) : computed.completionIso;

  return {
    ...profile,
    joining_date: joiningIso,
    completion_date: completionIso,
    metadata: {
      ...m,
      joining_date: joiningIso,
      completion_date: completionIso,
    },
  } as T;
}
