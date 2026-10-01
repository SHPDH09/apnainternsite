import type { ProjectReportFieldLayout } from "@/lib/projectReportTypes";
import {
  ACCOUNTING_TALLY_GST_BUNDLED_PDF_PATH,
  ACCOUNTING_TALLY_GST_DOMAIN_KEY,
  ACCOUNTING_TALLY_GST_DOMAIN_NAME,
  ACCOUNTING_TALLY_GST_FIELD_LAYOUT,
} from "@/lib/projectReportDomainLayouts/accountingTallyGst";
import {
  AI_ETHICS_POLICY_RESEARCH_BUNDLED_PDF_PATH,
  AI_ETHICS_POLICY_RESEARCH_DOMAIN_KEY,
  AI_ETHICS_POLICY_RESEARCH_DOMAIN_NAME,
  AI_ETHICS_POLICY_RESEARCH_FIELD_LAYOUT,
} from "@/lib/projectReportDomainLayouts/aiEthicsPolicyResearch";

export {
  ACCOUNTING_TALLY_GST_BUNDLED_PDF_PATH,
  ACCOUNTING_TALLY_GST_DOMAIN_KEY,
  ACCOUNTING_TALLY_GST_DOMAIN_NAME,
  AI_ETHICS_POLICY_RESEARCH_BUNDLED_PDF_PATH,
  AI_ETHICS_POLICY_RESEARCH_DOMAIN_KEY,
  AI_ETHICS_POLICY_RESEARCH_DOMAIN_NAME,
};

type BundledDomainConfig = {
  domainName: string;
  domainKey: string;
  fieldLayout: ProjectReportFieldLayout;
  bundledPdfPath: string;
};

const BUNDLED: BundledDomainConfig[] = [
  {
    domainName: ACCOUNTING_TALLY_GST_DOMAIN_NAME,
    domainKey: ACCOUNTING_TALLY_GST_DOMAIN_KEY,
    fieldLayout: ACCOUNTING_TALLY_GST_FIELD_LAYOUT,
    bundledPdfPath: ACCOUNTING_TALLY_GST_BUNDLED_PDF_PATH,
  },
  {
    domainName: AI_ETHICS_POLICY_RESEARCH_DOMAIN_NAME,
    domainKey: AI_ETHICS_POLICY_RESEARCH_DOMAIN_KEY,
    fieldLayout: AI_ETHICS_POLICY_RESEARCH_FIELD_LAYOUT,
    bundledPdfPath: AI_ETHICS_POLICY_RESEARCH_BUNDLED_PDF_PATH,
  },
];

function normalizeDomainKey(domain: string): string {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function resolveBundledProjectReportDomain(domain: string): BundledDomainConfig | null {
  const key = normalizeDomainKey(domain);
  const exact = BUNDLED.find(
    (b) => b.domainKey === key || normalizeDomainKey(b.domainName) === key
  );
  if (exact) return exact;
  if (/accounting/.test(key) && /tally/.test(key) && /gst/.test(key)) {
    return BUNDLED[0];
  }
  if (key === "accounting tally gst") return BUNDLED[0];
  if (
    /ai ethics/.test(key) &&
    /responsible/.test(key) &&
    (/technology/.test(key) || /tech/.test(key) || /policy/.test(key))
  ) {
    return BUNDLED.find((b) => b.domainKey === AI_ETHICS_POLICY_RESEARCH_DOMAIN_KEY) || null;
  }
  return null;
}

export function mergeBundledProjectReportLayout(
  domainKey: string,
  layout: ProjectReportFieldLayout
): ProjectReportFieldLayout {
  const bundled = BUNDLED.find((b) => b.domainKey === domainKey);
  if (!bundled) return layout;

  const hasCustomSlots =
    layout.placeholders && Object.keys(layout.placeholders).length > 0;
  const hasCustomRedactions = (layout.redactions?.length ?? 0) > 0;

  return {
    ...bundled.fieldLayout,
    ...layout,
    logo: layout.logo ?? bundled.fieldLayout.logo,
    universityName: layout.universityName ?? bundled.fieldLayout.universityName,
    placeholders: hasCustomSlots ? layout.placeholders : bundled.fieldLayout.placeholders,
    redactions: hasCustomRedactions ? layout.redactions : bundled.fieldLayout.redactions,
    template_version: layout.template_version ?? bundled.fieldLayout.template_version,
  };
}

export function bundledProjectReportPdfPath(domainKey: string): string | null {
  const bundled = BUNDLED.find((b) => b.domainKey === domainKey);
  return bundled?.bundledPdfPath ?? null;
}
