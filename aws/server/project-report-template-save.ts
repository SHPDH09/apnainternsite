import { query } from "./db.js";
import { ensureProjectReportSchema } from "./project-report-bootstrap.js";

export type SaveProjectReportTemplateInput = {
  domain_name: string;
  domain_key: string;
  template_pdf_path: string;
  template_pdf_url: string;
  template_file_name: string;
  updated_by?: string | null;
};

export async function assertAdminUserId(userId: string): Promise<void> {
  const { rows } = await query<{ role: string }>(
    `SELECT role::text AS role FROM public.user_roles WHERE user_id = $1::uuid`,
    [userId]
  );
  const isAdmin = rows.some((r) => r.role === "admin" || r.role === "super_admin");
  if (!isAdmin) {
    throw new Error("Admin privileges required.");
  }
}

export async function saveProjectReportTemplateRow(
  input: SaveProjectReportTemplateInput
): Promise<Record<string, unknown>> {
  await ensureProjectReportSchema();

  const { rows } = await query<Record<string, unknown>>(
    `INSERT INTO public.project_report_domain_templates (
      domain_name,
      domain_key,
      template_pdf_path,
      template_pdf_url,
      template_file_name,
      updated_by,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, now())
    ON CONFLICT (domain_key) DO UPDATE SET
      domain_name = EXCLUDED.domain_name,
      template_pdf_path = EXCLUDED.template_pdf_path,
      template_pdf_url = EXCLUDED.template_pdf_url,
      template_file_name = EXCLUDED.template_file_name,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
    RETURNING *`,
    [
      input.domain_name,
      input.domain_key,
      input.template_pdf_path,
      input.template_pdf_url,
      input.template_file_name,
      input.updated_by || null,
    ]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Could not save project report template row.");
  }
  return row;
}
