import {
  DEFAULT_PROJECT_REPORT_FIELD_LAYOUT,
  type ProjectReportDomainTemplate,
  type ProjectReportFieldLayout,
} from "@/lib/projectReportTypes";

function normalizeProjectReportDomainKey(domain: string): string {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Shipped with the frontend — used when admin has not uploaded a domain template yet. */
export const ACCOUNTING_TALLY_GST_TEMPLATE_URL =
  "/project-report-templates/accounting-tally-gst-project-report.pdf";

export const ACCOUNTING_TALLY_GST_TEMPLATE_FILE =
  "Accounting_Tally_GST_Project_Report.pdf";

export const AI_ETHICS_RESPONSIBLE_TECH_TEMPLATE_URL =
  "/project-report-templates/ai-ethics-responsible-tech-policy-research-project-report.pdf";

export const AI_ETHICS_RESPONSIBLE_TECH_TEMPLATE_FILE =
  "AI_Ethics_Responsible_Tech_Policy_Research_Project_Report.pdf";

/** A4 cover + certificate overlay coordinates (pdf-lib, origin bottom-left). */
export const ACCOUNTING_TALLY_GST_FIELD_LAYOUT: ProjectReportFieldLayout = {
  logo: { page: 0, x: 235, y: 706, width: 142, height: 88 },
};

export const AI_ETHICS_RESPONSIBLE_TECH_FIELD_LAYOUT: ProjectReportFieldLayout = {
  logo: { page: 0, x: 195, y: 688, width: 130, height: 52 },
};

export type ProjectReportBundledOverlayKind = "accounting-tally-gst" | "ai-ethics-responsible-tech";

const ACCOUNTING_DOMAIN_NAMES = ["Accounting & Tally with GST", "Accounting", "GST"] as const;

const AI_ETHICS_DOMAIN_NAMES = [
  "AI Ethics & Responsible Tech Policy Research",
  "AI Ethics & Responsible Tech",
] as const;

function accountingBundledRow(domainName: string): ProjectReportDomainTemplate {
  const domain_key = normalizeProjectReportDomainKey(domainName);
  return {
    id: `bundled-${domain_key.replace(/\s+/g, "-")}`,
    domain_name: domainName,
    domain_key,
    template_pdf_path: null,
    template_pdf_url: ACCOUNTING_TALLY_GST_TEMPLATE_URL,
    template_file_name: ACCOUNTING_TALLY_GST_TEMPLATE_FILE,
    field_layout: { ...ACCOUNTING_TALLY_GST_FIELD_LAYOUT },
    updated_at: "bundled",
  };
}

function aiEthicsBundledRow(domainName: string): ProjectReportDomainTemplate {
  const domain_key = normalizeProjectReportDomainKey(domainName);
  return {
    id: `bundled-${domain_key.replace(/\s+/g, "-")}`,
    domain_name: domainName,
    domain_key,
    template_pdf_path: null,
    template_pdf_url: AI_ETHICS_RESPONSIBLE_TECH_TEMPLATE_URL,
    template_file_name: AI_ETHICS_RESPONSIBLE_TECH_TEMPLATE_FILE,
    field_layout: { ...AI_ETHICS_RESPONSIBLE_TECH_FIELD_LAYOUT },
    updated_at: "bundled",
  };
}

const BUNDLED_BY_KEY = new Map<string, ProjectReportDomainTemplate>();
for (const name of ACCOUNTING_DOMAIN_NAMES) {
  const row = accountingBundledRow(name);
  BUNDLED_BY_KEY.set(row.domain_key, row);
}
for (const name of AI_ETHICS_DOMAIN_NAMES) {
  const row = aiEthicsBundledRow(name);
  BUNDLED_BY_KEY.set(row.domain_key, row);
}

export function getBundledProjectReportTemplate(
  domain: string
): ProjectReportDomainTemplate | null {
  const key = normalizeProjectReportDomainKey(domain);
  if (!key) return null;

  const exact = BUNDLED_BY_KEY.get(key);
  if (exact) return { ...exact };

  if (key.includes("tally") && (key.includes("account") || key.includes("gst"))) {
    return accountingBundledRow("Accounting & Tally with GST");
  }
  if (key === "accounting" || key === "gst" || key.includes("cost accounting")) {
    return BUNDLED_BY_KEY.get(normalizeProjectReportDomainKey("Accounting")) || null;
  }

  if (
    key.includes("ai ethics") &&
    (key.includes("responsible tech") || key.includes("policy research") || key.includes("policy"))
  ) {
    return aiEthicsBundledRow("AI Ethics & Responsible Tech Policy Research");
  }

  return null;
}

export function isAccountingTallyGstBundledTemplate(
  template: Pick<
    ProjectReportDomainTemplate,
    "template_pdf_url" | "template_file_name" | "domain_key" | "domain_name"
  > | null,
  domain?: string
): boolean {
  return resolveProjectReportBundledOverlayKind(template, domain) === "accounting-tally-gst";
}

export function isAiEthicsResponsibleTechBundledTemplate(
  template: Pick<
    ProjectReportDomainTemplate,
    "template_pdf_url" | "template_file_name" | "domain_key" | "domain_name"
  > | null,
  domain?: string
): boolean {
  return resolveProjectReportBundledOverlayKind(template, domain) === "ai-ethics-responsible-tech";
}

export function resolveProjectReportBundledOverlayKind(
  template: Pick<
    ProjectReportDomainTemplate,
    "template_pdf_url" | "template_file_name" | "domain_key" | "domain_name"
  > | null,
  domain?: string
): ProjectReportBundledOverlayKind | null {
  const key = normalizeProjectReportDomainKey(
    template?.domain_key || template?.domain_name || domain || ""
  );

  if (
    key === "accounting & tally with gst" ||
    key === "accounting" ||
    key === "gst" ||
    (key.includes("tally") && (key.includes("account") || key.includes("gst")))
  ) {
    return "accounting-tally-gst";
  }

  if (
    key === "ai ethics & responsible tech policy research" ||
    key === "ai ethics & responsible tech" ||
    (key.includes("ai ethics") &&
      (key.includes("responsible tech") || key.includes("policy research") || key.includes("policy")))
  ) {
    return "ai-ethics-responsible-tech";
  }

  if (!template) return null;

  const url = String(template.template_pdf_url || "");
  const file = String(template.template_file_name || "").toLowerCase();

  if (
    url.includes("accounting-tally-gst-project-report") ||
    file.includes("accounting_tally_gst")
  ) {
    return "accounting-tally-gst";
  }

  if (
    url.includes("ai-ethics-responsible-tech-policy-research") ||
    file.includes("ai_ethics_responsible_tech")
  ) {
    return "ai-ethics-responsible-tech";
  }

  return null;
}

/** All bundled domain names merged into admin template lists. */
export const BUNDLED_PROJECT_REPORT_DOMAIN_NAMES: readonly string[] = [
  ...ACCOUNTING_DOMAIN_NAMES,
  ...AI_ETHICS_DOMAIN_NAMES,
];
