/**
 * RPCs implemented in TypeScript (not as Postgres functions).
 * Used by /rest/v1/rpc/:name and /api/rpc/:name.
 */
import { ensureAllCmsTables } from "./cms-bootstrap";

export async function runTsRpc(name: string): Promise<unknown | null> {
  if (name === "admin_ensure_site_cms_tables") {
    return ensureAllCmsTables();
  }
  return null;
}

export function isTsRpc(name: string): boolean {
  return name === "admin_ensure_site_cms_tables";
}
