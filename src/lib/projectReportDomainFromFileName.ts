import { ACCOUNTING_TALLY_GST_DOMAIN_NAME } from "@/lib/projectReportDomainLayouts/accountingTallyGst";
import { AI_ETHICS_POLICY_RESEARCH_DOMAIN_NAME } from "@/lib/projectReportDomainLayouts/aiEthicsPolicyResearch";

/**
 * Infer internship domain from project report PDF file names, e.g.
 * `Accounting_Tally_GST_Project_Report_2c1f.pdf` → `Accounting, Tally & GST`
 */
export function inferProjectReportDomainFromFileName(fileName: string): string | null {
  let base = String(fileName || "")
    .trim()
    .replace(/\.pdf$/i, "");
  if (!base) return null;

  base = base.replace(/_[a-f0-9]{4,8}$/i, "");
  base = base.replace(/_project_report.*$/i, "").replace(/-project-report.*$/i, "");
  if (!base) return null;

  const normalized = base.replace(/[_-]+/g, " ").trim().toLowerCase();
  if (
    normalized === "accounting tally gst" ||
    (normalized.includes("accounting") && normalized.includes("tally") && normalized.includes("gst"))
  ) {
    return ACCOUNTING_TALLY_GST_DOMAIN_NAME;
  }

  if (
    normalized.includes("ai ethics") &&
    normalized.includes("responsible") &&
    (normalized.includes("policy") || normalized.includes("research") || normalized.includes("tech"))
  ) {
    return AI_ETHICS_POLICY_RESEARCH_DOMAIN_NAME;
  }

  const words = base.split(/[_-]+/).filter(Boolean);
  if (words.length === 0) return null;

  return words
    .map((w) => {
      const lower = w.toLowerCase();
      if (lower === "gst") return "GST";
      if (lower === "ai") return "AI";
      if (lower === "seo") return "SEO";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
