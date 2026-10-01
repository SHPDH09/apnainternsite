import type { ProjectReportFieldLayout } from "@/lib/projectReportTypes";
import type { DocumentPlaceholderKey } from "@/lib/studentDocumentPlaceholders";

/** Canonical admin / registration domain label for this template. */
export const ACCOUNTING_TALLY_GST_DOMAIN_NAME = "Accounting, Tally & GST";

export const ACCOUNTING_TALLY_GST_DOMAIN_KEY = "accounting, tally & gst";

/** Static fallback when storage URL is unavailable (bundled in /public). */
export const ACCOUNTING_TALLY_GST_BUNDLED_PDF_PATH = "/project-report-templates/accounting-tally-gst.pdf";

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
    maxWidth: opts?.maxWidth ?? 280,
    coverWidth: opts?.coverWidth ?? (opts?.maxWidth ?? 280) + 6,
    coverHeight: opts?.coverHeight ?? 13,
  };
}

function slots(
  key: DocumentPlaceholderKey,
  positions: ReturnType<typeof slot>[]
): Partial<Record<DocumentPlaceholderKey, ReturnType<typeof slot>[]>> {
  return { [key]: positions };
}

/**
 * pdf-lib text positions (bottom-left origin) derived from the approved client PDF.
 * Page numbers are 0-based.
 */
export const ACCOUNTING_TALLY_GST_FIELD_LAYOUT: ProjectReportFieldLayout = {
  template_version: 1,
  placeholders: {
    ...slots("university_name", [
      slot(0, 118, 664, { maxWidth: 360, coverWidth: 368, coverHeight: 16 }),
      slot(0, 275, 335),
    ]),
    ...slots("college_name", [
      slot(0, 154, 635, { maxWidth: 290, coverWidth: 298, coverHeight: 16 }),
      slot(0, 275, 315),
    ]),
    ...slots("student_name", [
      slot(0, 275, 396),
      slot(2, 88, 713, { maxWidth: 175, coverWidth: 180 }),
      slot(2, 350, 280, { maxWidth: 170 }),
      slot(3, 332, 319, { maxWidth: 190 }),
    ]),
    ...slots("university_registration_no", [
      slot(0, 275, 376),
      slot(2, 395, 713, { maxWidth: 120, coverWidth: 125 }),
      slot(3, 363, 293, { maxWidth: 155 }),
    ]),
    ...slots("university_roll_no", [
      slot(0, 275, 355),
      slot(2, 145, 694, { maxWidth: 115, coverWidth: 120 }),
      slot(2, 358, 267, { maxWidth: 165 }),
      slot(3, 358, 306, { maxWidth: 165 }),
    ]),
    ...slots("course_name", [
      slot(0, 275, 295),
      slot(0, 148, 452, { maxWidth: 300, coverWidth: 308, coverHeight: 14 }),
    ]),
    ...slots("branch_name", [
      slot(0, 275, 275),
      slot(0, 282, 436, { maxWidth: 260, coverWidth: 268, coverHeight: 14 }),
    ]),
    ...slots("semester_or_year", [slot(0, 275, 254)]),
    ...slots("academic_session", [
      slot(0, 275, 234),
      slot(0, 298, 115, { maxWidth: 200, coverWidth: 210, coverHeight: 14 }),
    ]),
    ...slots("supervisor_name", [slot(0, 275, 214)]),
  },
  redactions: [
    { page: 1, x: 68, y: 348, width: 210, height: 36 },
    { page: 1, x: 430, y: 348, width: 130, height: 36 },
    { page: 1, x: 68, y: 268, width: 200, height: 28 },
    { page: 2, x: 400, y: 285, width: 130, height: 40 },
    { page: 2, x: 340, y: 272, width: 190, height: 28 },
    { page: 3, x: 325, y: 310, width: 200, height: 42 },
  ],
};
