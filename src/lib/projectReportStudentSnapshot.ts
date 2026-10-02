import { isApnaInternRegistrationId } from "@/lib/certificateFormat";
import { enrichStudentProfileForDisplay } from "@/lib/studentProfileDisplay";
import { formatDocumentIssueDate } from "@/lib/studentPortalDocuments";

export type ProjectReportStudentSnapshot = {
  studentName: string;
  /** University registration no. (never Apna Intern EZY/API id). */
  universityRegistrationNumber: string;
  /** University roll no. */
  universityRollNumber: string;
  /** @deprecated Use universityRegistrationNumber — kept for callers. */
  registrationNumber: string;
  rollNumber: string;
  universityName: string;
  collegeName: string;
  /** Programme label: B.A., B.Sc., B.Com., etc. */
  programmeCourse: string;
  /** Internship / project domain (e.g. Accounting & Tally with GST). */
  internshipDomain: string;
  course: string;
  degree: string;
  department: string;
  semester: string;
  academicSession: string;
  /** For cover footer: "2023 – 2027" */
  sessionDisplay: string;
  submissionDate: string;
};

function pick(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s && s !== "—") return s;
  }
  return "";
}

/** B.A. / B.Sc. / B.Com. from subject line or degree — not internship domain or UG/PG. */
export function resolveProgrammeCourseLabel(
  profile: Record<string, unknown>,
  meta: Record<string, unknown>
): string {
  const subject = pick(profile.subject, meta.subject);
  const degree = pick(profile.degree, meta.degree);

  const normalizedSubject = subject.toLowerCase().replace(/\s+/g, "");
  if (/^b\.?a\.?/.test(normalizedSubject) || normalizedSubject.startsWith("ba")) return "B.A.";
  if (/^b\.?sc\.?/.test(normalizedSubject)) return "B.Sc.";
  if (/^b\.?com\.?/.test(normalizedSubject)) return "B.Com.";
  if (/^m\.?a\.?/.test(normalizedSubject)) return "M.A.";
  if (/^m\.?sc\.?/.test(normalizedSubject)) return "M.Sc.";
  if (/^b\.?tech\.?/.test(normalizedSubject)) return "B.Tech.";

  if (subject && !/accounting|tally|gst|internship/i.test(subject)) {
    const short = subject.split(/[,\-–(]/)[0]?.trim();
    if (short && short.length <= 24) return short;
  }

  if (degree && !/^UG$|^PG$/i.test(degree)) return degree;

  return subject || degree || "—";
}

export function formatAcademicSessionDisplay(session: string): string {
  const raw = String(session || "").trim();
  if (!raw) return "";
  const range = raw.match(/(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})/);
  if (range) {
    const end =
      range[2].length === 2 ? `20${range[2]}` : range[2];
    return `${range[1]} – ${end}`;
  }
  const years = raw.match(/20\d{2}/g);
  if (years && years.length >= 2) return `${years[0]} – ${years[1]}`;
  if (years?.length === 1) return years[0];
  return raw;
}

export function resolveUniversityRegistrationForProjectReport(
  profile: Record<string, unknown>,
  meta: Record<string, unknown>
): string {
  const candidates = [
    profile.university_registration_number,
    meta.university_registration_number,
    meta.universityRegistrationNumber,
    meta.registrationNo,
    profile.roll_number,
    meta.rollNo,
    meta.roll_number,
  ];
  for (const c of candidates) {
    const v = String(c ?? "").trim();
    if (v && !isApnaInternRegistrationId(v)) return v;
  }
  return "—";
}

export function resolveUniversityRollForProjectReport(
  profile: Record<string, unknown>,
  meta: Record<string, unknown>
): string {
  const candidates = [
    profile.university_roll_number,
    meta.university_roll_number,
    meta.universityRollNumber,
    profile.roll_number,
    meta.rollNo,
    meta.roll_number,
  ];
  for (const c of candidates) {
    const v = String(c ?? "").trim();
    if (v && !isApnaInternRegistrationId(v)) return v;
  }
  return "—";
}

export function resolveProjectReportStudentSnapshot(
  profile: Record<string, unknown> | null | undefined,
  options?: { internshipDomain?: string }
): ProjectReportStudentSnapshot {
  const p = enrichStudentProfileForDisplay(profile || {}) || {};
  const m =
    p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
      ? (p.metadata as Record<string, unknown>)
      : {};

  const studentName = pick(p.full_name, m.fullName, m.full_name) || "Student";
  const universityRegistrationNumber = resolveUniversityRegistrationForProjectReport(p, m);
  const universityRollNumber = resolveUniversityRollForProjectReport(p, m);
  const universityName = pick(p.university_name, m.university_name, m.university) || "—";
  const collegeName = pick(p.college_name, m.college_name, m.college) || "—";
  const internshipDomain =
    pick(options?.internshipDomain, p.internship_domain, m.internship_domain, p.course, m.course) ||
    "—";
  const programmeCourse = resolveProgrammeCourseLabel(p, m);
  const degree = pick(p.degree, m.degree) || "—";
  const department = pick(p.department, m.department, p.subject, m.subject) || "—";
  const semester = pick(p.class_semester, m.semester, m.classSem) || "—";
  const academicSession = pick(p.academic_session, m.session, m.academic_session) || "—";
  const sessionDisplay = formatAcademicSessionDisplay(academicSession);

  return {
    studentName,
    universityRegistrationNumber,
    universityRollNumber,
    registrationNumber: universityRegistrationNumber,
    rollNumber: universityRollNumber,
    universityName,
    collegeName,
    programmeCourse,
    internshipDomain,
    course: programmeCourse,
    degree,
    department,
    semester,
    academicSession,
    sessionDisplay,
    submissionDate: formatDocumentIssueDate(),
  };
}
