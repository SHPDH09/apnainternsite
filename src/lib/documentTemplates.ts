import type { SupabaseClient } from "@supabase/supabase-js";
import type { CertificateAssessmentRow, CertificateDisplayData } from "@/lib/certificateFormat";
import {
  CERTIFICATE_ASSESSMENT_CRITERIA,
  CERTIFICATE_CEO,
  CERTIFICATE_CEO_TITLE,
  CERTIFICATE_COMPANY,
  CERTIFICATE_CREDITS,
  CERTIFICATE_INTERNSHIP_PERIOD,
  CERTIFICATE_SIGNATURE_SRC,
  CERTIFICATE_TOTAL_HOURS,
  CERTIFICATE_VERIFY_URL,
} from "@/lib/certificateFormat";
import type { OfferLetterResolved } from "@/lib/offerLetterProfile";
import { ACCEPTANCE_LETTER_ISSUE_DATE, LNMU_STIPEND } from "@/lib/offerLetterProfile";

export type CertificateTemplateConfig = {
  defaultVariant?: "auto" | "standard" | "engineering";
  internshipPeriod?: string;
  totalHours?: string;
  credits?: string;
  verifyUrl?: string;
  companyName?: string;
  ceoName?: string;
  ceoTitle?: string;
  signatureSrc?: string;
  stampSrc?: string;
  assessmentCriteria?: string[];
};

export type OfferLetterTemplateConfig = {
  title?: string;
  titleLnmu?: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  website?: string;
  greeting?: string;
  introParagraph?: string;
  detailsHeading?: string;
  closingParagraph1?: string;
  closingParagraph2?: string;
  defaultStipend?: string;
  defaultIssueDate?: string;
};

export type StudentDocumentOverrides = {
  certificate?: Partial<CertificateDisplayData> & {
    studentName?: string | null;
    parentName?: string | null;
    internshipDomain?: string | null;
    internshipDuration?: string | null;
  };
  offerLetter?: Partial<OfferLetterResolved>;
};

export type DocumentTemplatesRow = {
  id: number;
  certificate: CertificateTemplateConfig;
  offer_letter: OfferLetterTemplateConfig;
  updated_at?: string | null;
  updated_by?: string | null;
};

export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplateConfig = {
  defaultVariant: "auto",
  internshipPeriod: CERTIFICATE_INTERNSHIP_PERIOD,
  totalHours: CERTIFICATE_TOTAL_HOURS,
  credits: CERTIFICATE_CREDITS,
  verifyUrl: CERTIFICATE_VERIFY_URL,
  companyName: CERTIFICATE_COMPANY,
  ceoName: CERTIFICATE_CEO,
  ceoTitle: CERTIFICATE_CEO_TITLE,
  signatureSrc: CERTIFICATE_SIGNATURE_SRC,
  stampSrc: "/certificate/stamp.png",
  assessmentCriteria: [...CERTIFICATE_ASSESSMENT_CRITERIA],
};

export const DEFAULT_OFFER_LETTER_TEMPLATE: OfferLetterTemplateConfig = {
  title: "INTERNSHIP OFFER LETTER",
  titleLnmu: "Internship Acceptance Letters",
  addressLine1: "Arfabad Colony, East Nahar Road, Bajranngpuri,",
  addressLine2: "Patna - 800007",
  phone: "7050936593",
  email: "contact@ezyintern.in",
  website: "www.ezyintern.in",
  greeting: "Dear Candidate,",
  introParagraph:
    "We are pleased to accept your application and formally offer you an internship at Apna Intern. Our internship programmes are designed in full alignment with NEP-2020, AICTE and UGC Internship Guidelines, and your university's specific internship framework.",
  detailsHeading: "Your internship details are as follows:",
  closingParagraph1:
    "Please report to us on your start date as per the schedule above and bring this letter along with the Consent Letter issued by your College. We also request that you inform your College Internship Nodal Officer (CINO) upon receiving this acceptance letter. During the programme, you are required to maintain the minimum required attendance and complete all tasks and assignments given by your mentor.",
  closingParagraph2:
    "We look forward to a meaningful and enriching internship experience and appreciate your interest in Apna Intern.",
  defaultStipend: LNMU_STIPEND,
  defaultIssueDate: ACCEPTANCE_LETTER_ISSUE_DATE,
};

let cachedTemplates: DocumentTemplatesRow | null = null;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeTemplate<T extends Record<string, unknown>>(defaults: T, raw: unknown): T {
  const patch = asObject(raw);
  const out = { ...defaults };
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function normalizeDocumentTemplatesRow(raw: Record<string, unknown> | null): DocumentTemplatesRow {
  return {
    id: 1,
    certificate: mergeTemplate(
      DEFAULT_CERTIFICATE_TEMPLATE as unknown as Record<string, unknown>,
      raw?.certificate
    ) as CertificateTemplateConfig,
    offer_letter: mergeTemplate(
      DEFAULT_OFFER_LETTER_TEMPLATE as unknown as Record<string, unknown>,
      raw?.offer_letter
    ) as OfferLetterTemplateConfig,
    updated_at: raw?.updated_at ? String(raw.updated_at) : null,
    updated_by: raw?.updated_by ? String(raw.updated_by) : null,
  };
}

export function getCachedDocumentTemplates(): DocumentTemplatesRow {
  return cachedTemplates || normalizeDocumentTemplatesRow(null);
}

export function setCachedDocumentTemplates(row: DocumentTemplatesRow | null) {
  cachedTemplates = row;
}

export async function fetchDocumentTemplates(client: SupabaseClient): Promise<DocumentTemplatesRow> {
  const { data, error } = await client.from("document_templates").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  const normalized = normalizeDocumentTemplatesRow((data as Record<string, unknown>) || null);
  cachedTemplates = normalized;
  return normalized;
}

export async function saveDocumentTemplates(
  client: SupabaseClient,
  patch: {
    certificate?: CertificateTemplateConfig;
    offer_letter?: OfferLetterTemplateConfig;
  },
  updatedBy: string | null
): Promise<DocumentTemplatesRow> {
  const current = await fetchDocumentTemplates(client);
  const payload = {
    id: 1,
    certificate: patch.certificate ?? current.certificate,
    offer_letter: patch.offer_letter ?? current.offer_letter,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client.from("document_templates").upsert(payload).select("*").single();
  if (error) throw error;
  const normalized = normalizeDocumentTemplatesRow(data as Record<string, unknown>);
  cachedTemplates = normalized;
  return normalized;
}

export function readStudentDocumentOverrides(
  student: Record<string, unknown> | null | undefined
): StudentDocumentOverrides {
  const raw = student?.document_overrides ?? student?.documentOverrides;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as StudentDocumentOverrides;
  return {
    certificate: obj.certificate && typeof obj.certificate === "object" ? obj.certificate : undefined,
    offerLetter: obj.offerLetter && typeof obj.offerLetter === "object" ? obj.offerLetter : undefined,
  };
}

function pickNonEmpty<T extends Record<string, unknown>>(patch: Partial<T> | undefined): Partial<T> {
  if (!patch) return {};
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function applyStudentCertificateOverrides(
  data: CertificateDisplayData,
  student: Record<string, unknown> | null | undefined
): CertificateDisplayData {
  const patch = pickNonEmpty(readStudentDocumentOverrides(student).certificate as Record<string, unknown>);
  if (!Object.keys(patch).length) return data;
  return { ...data, ...(patch as Partial<CertificateDisplayData>) };
}

export function applyStudentOfferLetterOverrides(
  fields: OfferLetterResolved,
  student: Record<string, unknown> | null | undefined
): OfferLetterResolved {
  const patch = pickNonEmpty(readStudentDocumentOverrides(student).offerLetter as Record<string, unknown>);
  if (!Object.keys(patch).length) return fields;
  return { ...fields, ...(patch as Partial<OfferLetterResolved>) };
}

export type StudentCertificateCustomizationForm = {
  studentName: string;
  parentName: string;
  universityRollNo: string;
  universityRegistrationNumber: string;
  collegeName: string;
  universityName: string;
  academicSession: string;
  degree: string;
  department: string;
  subject: string;
  internshipDomain: string;
  internshipDuration: string;
  internshipMode: string;
  totalHours: string;
  creditsRecommended: string;
  marksPercent: string;
  semester: string;
  gender: string;
  startDate: string;
  endDate: string;
  durationLabel: string;
  assessmentRows: CertificateAssessmentRow[];
};

export type StudentOfferLetterCustomizationForm = {
  issueDate: string;
  letterRefNo: string;
  fullName: string;
  registrationNo: string;
  universityRollNo: string;
  collegeName: string;
  departmentSemester: string;
  internshipDomain: string;
  internshipDuration: string;
  internshipMode: string;
  startDate: string;
  endDate: string;
  stipend: string;
};

export function studentCertificateFormFromSources(
  display: CertificateDisplayData,
  student: Record<string, unknown> | null | undefined
): StudentCertificateCustomizationForm {
  const saved = readStudentDocumentOverrides(student).certificate || {};
  const edit = {
    studentName: saved.studentName ?? display.studentName ?? "",
    parentName: saved.parentName ?? display.parentName ?? "",
    universityRollNo: saved.universityRollNo ?? display.universityRollNo ?? "",
    universityRegistrationNumber:
      saved.universityRegistrationNumber ?? display.universityRegistrationNumber ?? "",
    collegeName: saved.collegeName ?? display.collegeName ?? "",
    universityName: saved.universityName ?? display.universityName ?? "",
    academicSession: saved.academicSession ?? display.academicSession ?? "",
    degree: saved.degree ?? display.degree ?? "",
    department: saved.subject ?? display.subject ?? "",
    subject: saved.subject ?? display.subject ?? "",
    internshipDomain: saved.internshipDomain ?? display.internshipDomain ?? "",
    internshipDuration: saved.internshipDuration ?? display.internshipDuration ?? "",
    internshipMode: saved.internshipMode ?? display.internshipMode ?? "",
    totalHours: saved.totalHours ?? display.totalHours ?? "",
    creditsRecommended: saved.creditsRecommended ?? display.creditsRecommended ?? "",
    marksPercent: saved.marksPercent ?? display.marksPercent ?? "",
    semester: saved.semester ?? display.semester ?? "",
    gender: saved.gender ?? display.gender ?? "",
    startDate: saved.startDate ?? display.startDate ?? "",
    endDate: saved.endDate ?? display.endDate ?? "",
    durationLabel: saved.durationLabel ?? display.durationLabel ?? "",
    assessmentRows: saved.assessmentRows ?? display.assessmentRows ?? [],
  };
  return edit as StudentCertificateCustomizationForm;
}

export function studentOfferLetterFormFromSources(
  fields: OfferLetterResolved,
  student: Record<string, unknown> | null | undefined
): StudentOfferLetterCustomizationForm {
  const saved = readStudentDocumentOverrides(student).offerLetter || {};
  return {
    issueDate: saved.issueDate ?? fields.issueDate ?? "",
    letterRefNo: saved.letterRefNo ?? fields.letterRefNo ?? "",
    fullName: saved.fullName ?? fields.fullName ?? "",
    registrationNo: saved.registrationNo ?? fields.registrationNo ?? "",
    universityRollNo: saved.universityRollNo ?? fields.universityRollNo ?? "",
    collegeName: saved.collegeName ?? fields.collegeName ?? "",
    departmentSemester: saved.departmentSemester ?? fields.departmentSemester ?? "",
    internshipDomain: saved.internshipDomain ?? fields.internshipDomain ?? "",
    internshipDuration: saved.internshipDuration ?? fields.internshipDuration ?? "",
    internshipMode: saved.internshipMode ?? fields.internshipMode ?? "",
    startDate: saved.startDate ?? fields.startDate ?? "",
    endDate: saved.endDate ?? fields.endDate ?? "",
    stipend: saved.stipend ?? fields.stipend ?? "",
  };
}

function pickString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function studentDocumentOverridesFromForms(
  certificate: StudentCertificateCustomizationForm,
  offerLetter: StudentOfferLetterCustomizationForm
): StudentDocumentOverrides {
  return {
    certificate: {
      studentName: pickString(certificate.studentName),
      parentName: pickString(certificate.parentName),
      universityRollNo: pickString(certificate.universityRollNo),
      universityRegistrationNumber: pickString(certificate.universityRegistrationNumber),
      collegeName: pickString(certificate.collegeName),
      universityName: pickString(certificate.universityName),
      academicSession: pickString(certificate.academicSession),
      degree: pickString(certificate.degree),
      subject: pickString(certificate.subject || certificate.department),
      internshipDomain: pickString(certificate.internshipDomain),
      internshipDuration: pickString(certificate.internshipDuration),
      internshipMode: pickString(certificate.internshipMode),
      totalHours: pickString(certificate.totalHours),
      creditsRecommended: pickString(certificate.creditsRecommended),
      marksPercent: pickString(certificate.marksPercent),
      semester: pickString(certificate.semester),
      gender: pickString(certificate.gender),
      startDate: pickString(certificate.startDate),
      endDate: pickString(certificate.endDate),
      durationLabel: pickString(certificate.durationLabel),
      assessmentRows: certificate.assessmentRows?.length ? certificate.assessmentRows : undefined,
    },
    offerLetter: {
      issueDate: pickString(offerLetter.issueDate),
      letterRefNo: pickString(offerLetter.letterRefNo),
      fullName: pickString(offerLetter.fullName),
      registrationNo: pickString(offerLetter.registrationNo),
      universityRollNo: pickString(offerLetter.universityRollNo),
      collegeName: pickString(offerLetter.collegeName),
      departmentSemester: pickString(offerLetter.departmentSemester),
      internshipDomain: pickString(offerLetter.internshipDomain),
      internshipDuration: pickString(offerLetter.internshipDuration),
      internshipMode: pickString(offerLetter.internshipMode),
      startDate: pickString(offerLetter.startDate),
      endDate: pickString(offerLetter.endDate),
      stipend: pickString(offerLetter.stipend),
    },
  };
}

export async function saveStudentDocumentOverrides(
  client: SupabaseClient,
  studentId: string,
  overrides: StudentDocumentOverrides
): Promise<void> {
  const { error } = await client
    .from("students")
    .update({ document_overrides: overrides })
    .eq("id", studentId);
  if (error) throw error;
}
