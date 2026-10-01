import type { DocumentPlaceholderKey } from "@/lib/studentDocumentPlaceholders";

export type ProjectReportTextSlot = {
  page: number;
  x: number;
  y: number;
  size: number;
  maxWidth?: number;
  /** When set, white-out this area before drawing (covers sample PDF text / stamps). */
  coverWidth?: number;
  coverHeight?: number;
};

export type ProjectReportFieldLayout = {
  logo?: { page: number; x: number; y: number; width: number; height: number };
  universityName?: { page: number; x: number; y: number; size: number; maxWidth?: number };
  domain?: { page: number; x: number; y: number; size: number };
  mode?: { page: number; x: number; xLabel?: number; y: number; size: number };
  domainContent?: { page: number; x: number; y: number; width: number; size: number; lineHeight: number };
  /** Per-placeholder draw positions (pdf-lib coords, bottom-left origin). Multiple slots per key allowed. */
  placeholders?: Partial<Record<DocumentPlaceholderKey, ProjectReportTextSlot[]>>;
  /** Cover fixed regions (e.g. embedded signature images on template pages). */
  redactions?: Array<{ page: number; x: number; y: number; width: number; height: number }>;
  template_version?: number;
};

export const DEFAULT_PROJECT_REPORT_FIELD_LAYOUT: ProjectReportFieldLayout = {
  logo: { page: 0, x: 72, y: 720, width: 72, height: 72 },
  universityName: { page: 0, x: 160, y: 760, size: 16, maxWidth: 360 },
  domain: { page: 0, x: 72, y: 640, size: 12 },
  mode: { page: 0, x: 72, y: 620, size: 12 },
  domainContent: { page: 1, x: 72, y: 720, width: 460, size: 10, lineHeight: 14 },
};

export type ProjectReportDomainTemplate = {
  id: string;
  domain_name: string;
  domain_key: string;
  template_pdf_path: string | null;
  template_pdf_url: string | null;
  template_file_name: string | null;
  field_layout: ProjectReportFieldLayout;
  template_version?: number;
  updated_at?: string;
};

/** @deprecated Use ProjectReportDomainTemplate */
export type ProjectReportSettings = ProjectReportDomainTemplate;
