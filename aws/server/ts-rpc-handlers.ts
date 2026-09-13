/**
 * RPCs implemented in TypeScript (not as Postgres functions).
 * Used by /rest/v1/rpc/:name and /api/rpc/:name.
 */
import { ensureAllCmsTables } from "./cms-bootstrap.js";
import { ensureDashboardServiceKeysTable } from "./dashboard-service-keys-bootstrap.js";
import { ensurePartnerApplicationsTables } from "./partner-applications-bootstrap.js";
import { ensureProjectReportSchema } from "./project-report-bootstrap.js";

export async function runTsRpc(name: string): Promise<unknown | null> {
  if (name === "admin_ensure_site_cms_tables") {
    return ensureAllCmsTables();
  }
  if (name === "admin_ensure_dashboard_service_keys") {
    return ensureDashboardServiceKeysTable();
  }
  if (name === "admin_ensure_partner_applications") {
    return ensurePartnerApplicationsTables();
  }
  if (name === "admin_ensure_project_report_templates") {
    return ensureProjectReportSchema();
  }
  return null;
}

export function isTsRpc(name: string): boolean {
  return (
    name === "admin_ensure_site_cms_tables" ||
    name === "admin_ensure_dashboard_service_keys" ||
    name === "admin_ensure_partner_applications" ||
    name === "admin_ensure_project_report_templates"
  );
}
