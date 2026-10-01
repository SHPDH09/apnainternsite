import type { ProjectReportFieldLayout } from "@/lib/projectReportTypes";
import type { DocumentPlaceholderKey } from "@/lib/studentDocumentPlaceholders";

/** Matches `public.internship_domains` / technical registration list. */
export const AI_ETHICS_POLICY_RESEARCH_DOMAIN_NAME =
  "AI Ethics & Responsible Technology Policy Research";

export const AI_ETHICS_POLICY_RESEARCH_DOMAIN_KEY =
  "ai ethics & responsible technology policy research";

export const AI_ETHICS_POLICY_RESEARCH_BUNDLED_PDF_PATH =
  "/project-report-templates/ai-ethics-responsible-tech-policy-research.pdf";

function slot(
  page: number,
  x: number,
  y: number,
  opts?: { size?: number; maxWidth?: number; coverWidth?: number; coverHeight?: number }
) {
  return {
    page,
    x,
    y,
    size: opts?.size ?? 10,
    maxWidth: opts?.maxWidth ?? 260,
    coverWidth: opts?.coverWidth ?? (opts?.maxWidth ?? 260) + 8,
    coverHeight: opts?.coverHeight ?? 13,
  };
}

function slots(
  key: DocumentPlaceholderKey,
  positions: ReturnType<typeof slot>[]
): Partial<Record<DocumentPlaceholderKey, ReturnType<typeof slot>[]>> {
  return { [key]: positions };
}

/** Coordinates from client PDF (pdf.js, bottom-left origin). */
export const AI_ETHICS_POLICY_RESEARCH_FIELD_LAYOUT: ProjectReportFieldLayout = {
  template_version: 1,
  placeholders: {
    ...slots("university_name", [
      slot(0, 172, 684, { maxWidth: 350, coverWidth: 358, coverHeight: 14 }),
      slot(0, 313, 368),
    ]),
    ...slots("college_name", [
      slot(0, 172, 651, { maxWidth: 350, coverWidth: 358, coverHeight: 14 }),
      slot(0, 313, 351),
    ]),
    ...slots("student_name", [
      slot(0, 313, 418),
      slot(2, 58, 704, { maxWidth: 200, coverWidth: 205 }),
    ]),
    ...slots("university_registration_no", [
      slot(0, 313, 401),
      slot(2, 320, 704, { maxWidth: 120, coverWidth: 125 }),
    ]),
    ...slots("university_roll_no", [
      slot(0, 313, 384),
      slot(2, 58, 691, { maxWidth: 115, coverWidth: 120 }),
    ]),
    ...slots("course_name", [
      slot(0, 313, 334),
      slot(0, 166, 471, { maxWidth: 300, coverWidth: 308, coverHeight: 14 }),
    ]),
    ...slots("branch_name", [
      slot(0, 313, 317),
      slot(0, 282, 458, { maxWidth: 250, coverWidth: 258, coverHeight: 14 }),
    ]),
    ...slots("semester_or_year", [slot(0, 313, 301)]),
    ...slots("academic_session", [
      slot(0, 313, 284),
      slot(0, 303, 190, { maxWidth: 200, coverWidth: 210, coverHeight: 14 }),
    ]),
    ...slots("supervisor_name", [slot(0, 313, 267)]),
  },
  redactions: [
    { page: 1, x: 48, y: 492, width: 200, height: 38 },
    { page: 1, x: 228, y: 492, width: 130, height: 38 },
    { page: 1, x: 48, y: 440, width: 200, height: 28 },
  ],
};
