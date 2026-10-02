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

/** A4 cover + certificate overlay coordinates (pdf-lib, origin bottom-left). */
export const ACCOUNTING_TALLY_GST_FIELD_LAYOUT: ProjectReportFieldLayout = {
  logo: { page: 0, x: 235, y: 706, width: 142, height: 88 },
};

const BUNDLED_DOMAIN_NAMES = [
  "Accounting & Tally with GST",
  "Accounting",
  "GST",
] as const;

function bundledRow(domainName: string): ProjectReportDomainTemplate {
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

const BUNDLED_BY_KEY = new Map<string, ProjectReportDomainTemplate>();
for (const name of BUNDLED_DOMAIN_NAMES) {
  const row = bundledRow(name);
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
    return bundledRow("Accounting & Tally with GST");
  }
  if (key === "accounting" || key === "gst" || key.includes("cost accounting")) {
    return BUNDLED_BY_KEY.get(normalizeProjectReportDomainKey("Accounting")) || null;
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
  const key = normalizeProjectReportDomainKey(
    template?.domain_key || template?.domain_name || domain || ""
  );
  if (
    key === "accounting & tally with gst" ||
    key === "accounting" ||
    key === "gst" ||
    (key.includes("tally") && (key.includes("account") || key.includes("gst")))
  ) {
    return true;
  }
  if (!template) return false;
  const url = String(template.template_pdf_url || "");
  const file = String(template.template_file_name || "");
  return (
    url.includes("accounting-tally-gst-project-report") ||
    file.toLowerCase().includes("accounting_tally_gst")
  );
}
