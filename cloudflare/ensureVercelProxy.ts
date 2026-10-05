import { proxyRequestToVercel } from "./otpVercelFallback";

const VERCEL_ENSURE_API_PATHS = new Set([
  "/api/ensure-staff-attendance-offices",
  "/api/ensure-partner-applications",
  "/api/ensure-project-report-templates",
  "/api/ensure-learning-materials",
  "/api/ensure-blog-cms",
  "/api/staff-office-rpc",
  "/api/rds-apply-all",
]);

/** RDS-backed blog images — served on Vercel (DATABASE_URL), not Lambda until redeployed. */
const VERCEL_PUBLIC_GET_API_PATHS = new Set(["/api/public/blog-media"]);

/** Blog views/leads — RDS on Vercel (not Lambda). */
const VERCEL_BLOG_POST_API_PATHS = new Set(["/api/blog-interaction"]);

/** Admin blog CMS list/leads — Vercel serverless (Lambda returns 404). */
const VERCEL_ADMIN_BLOG_GET_PATHS = new Set([
  "/api/admin-blog-posts",
  "/api/admin-blog-leads",
]);

/** Razorpay + order lookup — Vercel serverless (DATABASE_URL), not API Gateway Lambda. */
function isVercelPaymentApi(path: string): boolean {
  return path.startsWith("/api/payment/") || path === "/api/razorpay-recovery";
}

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
  if (VERCEL_ENSURE_API_PATHS.has(path)) {
    return proxyRequestToVercel(request, env);
  }
  if (VERCEL_PUBLIC_GET_API_PATHS.has(path) && request.method === "GET") {
    return proxyRequestToVercel(request, env);
  }
  if (VERCEL_BLOG_POST_API_PATHS.has(path) && request.method === "POST") {
    return proxyRequestToVercel(request, env);
  }
  if (VERCEL_ADMIN_BLOG_GET_PATHS.has(path) && request.method === "GET") {
    return proxyRequestToVercel(request, env);
  }
  if (isVercelPaymentApi(path)) {
    return proxyRequestToVercel(request, env);
  }
  return null;
}
