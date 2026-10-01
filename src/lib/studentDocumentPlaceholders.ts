import type { StudentDocumentFields } from "@/lib/studentPortalDocuments";

/** Proposed template tokens (spec v1.1). */
export const DOCUMENT_PLACEHOLDER_KEYS = [
  "student_name",
  "university_name",
  "college_name",
  "course_name",
  "branch_name",
  "academic_session",
  "semester_or_year",
  "university_roll_no",
  "university_registration_no",
  "internship_enrolment_no",
  "certificate_number",
  "domain_name",
  "start_date",
  "end_date",
  "duration",
  "mode",
  "mobile",
  "email",
  "supervisor_name",
] as const;

export type DocumentPlaceholderKey = (typeof DOCUMENT_PLACEHOLDER_KEYS)[number];

export type DocumentPlaceholderValues = Record<DocumentPlaceholderKey, string>;

export type PlaceholderValidationResult = {
  ok: boolean;
  missing: DocumentPlaceholderKey[];
  values: DocumentPlaceholderValues;
};

const REQUIRED_FOR_PROJECT_REPORT: DocumentPlaceholderKey[] = [
  "student_name",
  "university_name",
  "college_name",
  "domain_name",
  "start_date",
  "end_date",
  "mode",
  "mobile",
  "email",
];

export function buildDocumentPlaceholderValues(
  fields: StudentDocumentFields,
  extras?: {
    certificateNumber?: string | null;
    supervisorName?: string | null;
  }
): DocumentPlaceholderValues {
  const semesterOrYear =
    fields.semester && fields.semester !== "—"
      ? fields.semester.replace(/^semester\s/i, "").trim()
      : fields.programSemester !== "—"
        ? fields.programSemester
        : "—";

  return {
    student_name: fields.studentName,
    university_name: fields.university,
    college_name: fields.collegeName,
    course_name: fields.course,
    branch_name: fields.subject,
    academic_session: fields.session,
    semester_or_year: semesterOrYear,
    university_roll_no: fields.universityRollNumber,
    university_registration_no: fields.universityRegistrationNumber,
    internship_enrolment_no: fields.registrationNumber,
    certificate_number: String(extras?.certificateNumber || "—").trim() || "—",
    domain_name: fields.domain,
    start_date: fields.startDate,
    end_date: fields.endDate,
    duration: fields.duration,
    mode: fields.mode,
    mobile: fields.mobile,
    email: fields.email,
    supervisor_name: String(extras?.supervisorName || "—").trim() || "—",
  };
}

function isMissingValue(v: string): boolean {
  const t = v.trim();
  return !t || t === "—" || t === "N/A";
}

export function validateDocumentPlaceholders(
  values: DocumentPlaceholderValues,
  required: DocumentPlaceholderKey[] = REQUIRED_FOR_PROJECT_REPORT
): PlaceholderValidationResult {
  const missing = required.filter((key) => isMissingValue(values[key] ?? ""));
  return { ok: missing.length === 0, missing, values };
}

export function formatMissingPlaceholderMessage(missing: DocumentPlaceholderKey[]): string {
  if (missing.length === 0) return "";
  const labels = missing.map((k) => k.replace(/_/g, " "));
  return `Complete your profile first. Missing: ${labels.join(", ")}.`;
}

export const PROJECT_REPORT_DOMAIN_UNAVAILABLE =
  "Project report is not available for this domain yet.";

/** Bracket and mustache forms used in prepared PDF templates. */
export function placeholderTokenVariants(key: DocumentPlaceholderKey): string[] {
  const upper = key.toUpperCase();
  return [
    `{{${key}}}`,
    `{{ ${key} }}`,
    `{{${upper}}}`,
    `[${key}]`,
  ];
}
