import { displayRegistrationId } from "@/lib/registrationId";
import { enrichStudentProfileForDisplay } from "@/lib/studentProfileDisplay";
import { formatDocumentIssueDate } from "@/lib/studentPortalDocuments";

export type ProjectReportStudentSnapshot = {
  studentName: string;
  registrationNumber: string;
  rollNumber: string;
  universityName: string;
  collegeName: string;
  course: string;
  degree: string;
  department: string;
  semester: string;
  academicSession: string;
  submissionDate: string;
};

export function resolveProjectReportStudentSnapshot(
  profile: Record<string, unknown> | null | undefined
): ProjectReportStudentSnapshot {
  const p = enrichStudentProfileForDisplay(profile || {}) || {};
  const m =
    p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
      ? (p.metadata as Record<string, unknown>)
      : {};

  const pick = (...values: unknown[]) => {
    for (const v of values) {
      const s = String(v ?? "").trim();
      if (s && s !== "—") return s;
    }
    return "";
  };

  const studentName = pick(p.full_name, m.fullName, m.full_name) || "Student";
  const registrationNumber =
    displayRegistrationId(p.registration_id) ||
    pick(p.registration_id, m.registration_id) ||
    "—";
  const rollNumber = pick(p.roll_number, m.rollNo, m.roll_number) || "—";
  const universityName = pick(p.university_name, m.university_name, m.university) || "—";
  const collegeName = pick(p.college_name, m.college_name, m.college) || "—";
  const degree = pick(p.degree, m.degree) || "—";
  const course = pick(p.course, p.internship_domain, m.course, m.internship_domain) || degree;
  const department = pick(p.department, m.department, p.subject, m.subject) || "—";
  const semester = pick(p.class_semester, m.semester, m.classSem) || "—";
  const academicSession = pick(p.academic_session, m.session, m.academic_session) || "—";

  return {
    studentName,
    registrationNumber,
    rollNumber,
    universityName,
    collegeName,
    course,
    degree,
    department,
    semester,
    academicSession,
    submissionDate: formatDocumentIssueDate(),
  };
}
