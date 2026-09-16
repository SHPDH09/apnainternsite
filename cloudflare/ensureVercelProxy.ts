import { proxyRequestToVercel } from "./otpVercelFallback";

const VERCEL_ENSURE_API_PATHS = new Set([
  "/api/ensure-staff-attendance-offices",
  "/api/ensure-partner-applications",
  "/api/ensure-project-report-templates",
  "/api/staff-office-rpc",
  "/api/staff-register-face",
  "/api/rds-apply-all",
]);

function upstreamPath(pathname: string): string {
  const stage = "/staging";
  if (pathname === stage || pathname.startsWith(`${stage}/`)) {
    return pathname.slice(stage.length) || "/";
  }
  return pathname;
}

/** RDS bootstrap handlers run on Vercel (DATABASE_URL), not Lambda. */
export async function tryProxyEnsureApiToVercel(
  request: Request,
  env: { VERCEL_MAIL_ORIGIN?: string },
): Promise<Response | null> {
  const path = upstreamPath(new URL(request.url).pathname);
  if (!VERCEL_ENSURE_API_PATHS.has(path)) return null;
  return proxyRequestToVercel(request, env);
}
