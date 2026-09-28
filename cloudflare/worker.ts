/**
 * Cloudflare Worker — proxy /auth, /rest, /storage, /functions, /api to AWS Lambda.
 * OTP mail is relayed to Vercel (/api/otp-deliver) for Hostinger SMTP delivery.
 */

import { tryHandleOtpDeliver } from "./otpDeliver";
import { resolveOtpPurpose } from "./otpMail";
import { tryProxyEnsureApiToVercel } from "./ensureVercelProxy";
import { proxyOtpDeliverToVercel, proxyRequestToVercel } from "./otpVercelFallback";

export interface Env {
  ASSETS: Fetcher;
  LAMBDA_ORIGIN: string;
  LAMBDA_STAGE?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAIL_FROM_ADDRESS?: string;
  VERCEL_MAIL_ORIGIN?: string;
}

const API_PREFIXES = ["/auth", "/rest", "/storage", "/functions", "/api"];
const STAGE_SEGMENT = "/staging";

const DEFAULT_LAMBDA_ORIGIN =
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

function lambdaOrigin(env: Env): string {
  const stage = String(env.LAMBDA_STAGE || "staging")
    .replace(/^\//, "")
    .replace(/\/$/, "");
  let origin = (env.LAMBDA_ORIGIN || DEFAULT_LAMBDA_ORIGIN).replace(/\/$/, "");
  origin = origin.replace(/\/staging$/i, "").replace(/\/production$/i, "");
  if (/execute-api\.[a-z0-9-]+\.amazonaws\.com$/i.test(origin) && stage) {
    origin = `${origin}/${stage}`;
  }
  return origin;
}

function upstreamPath(pathname: string): string {
  if (pathname === STAGE_SEGMENT || pathname.startsWith(`${STAGE_SEGMENT}/`)) {
    return pathname.slice(STAGE_SEGMENT.length) || "/";
  }
  return pathname;
}

function shouldProxy(pathname: string): boolean {
  if (pathname === STAGE_SEGMENT || pathname.startsWith(`${STAGE_SEGMENT}/`)) {
    return true;
  }
  return API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function buildLambdaTarget(env: Env, pathname: string, search: string): string {
  const path = upstreamPath(pathname);
  const base = lambdaOrigin(env).replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}${search}`;
}

function isSendMailPath(pathname: string): boolean {
  const p = upstreamPath(pathname);
  return p === "/api/send-mail" || p.endsWith("/api/send-mail");
}

type SendMailBody = {
  action?: string;
  type?: string;
  otp?: string;
  to?: string;
  email?: string;
  purpose?: string;
};

/** RDS bootstrap/RPC actions live on Vercel send-mail (DATABASE_URL), not Lambda. */
async function tryHandleVercelSendMailActions(
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "POST" || !isSendMailPath(new URL(request.url).pathname)) {
    return null;
  }

  let body: SendMailBody & { name?: string; rpc?: string };
  try {
    body = (await request.clone().json()) as SendMailBody & { name?: string; rpc?: string };
  } catch {
    return null;
  }

  const action = String(body.action || body.type || "")
    .trim()
    .toLowerCase();
  const vercelSendMailActions = new Set([
    "ensure_blog_cms",
    "ensure_project_report_templates",
    "save_project_report_template",
    "blog_increment_view",
    "blog_get_view",
    "blog_submit_lead",
    "blog_lookup_phone",
  ]);
  if (!vercelSendMailActions.has(action)) return null;

  return proxyRequestToVercel(request, env);
}

async function tryHandleOtpSendMail(request: Request, env: Env): Promise<Response | null> {
  if (request.method !== "POST" || !isSendMailPath(new URL(request.url).pathname)) {
    return null;
  }

  let body: SendMailBody;
  try {
    body = (await request.clone().json()) as SendMailBody;
  } catch {
    return null;
  }

  const action = String(body.action || body.type || "")
    .trim()
    .toLowerCase();
  if (
    action !== "login_otp" &&
    action !== "send_otp" &&
    action !== "otp_deliver" &&
    action !== "request_otp"
  ) {
    return null;
  }

  if (action === "otp_deliver" || action === "request_otp") {
    return tryHandleOtpDeliver(request, env);
  }

  const recipient = String(body.to || body.email || "")
    .trim()
    .toLowerCase();
  const otp = String(body.otp || "").trim();
  if (!recipient.includes("@") || otp.length < 6) {
    return Response.json(
      { success: false, message: "Missing recipient email or OTP for send_otp/login_otp" },
      { status: 400 },
    );
  }

  resolveOtpPurpose(body.purpose || (action === "login_otp" ? "login" : "password_reset"));

  return proxyOtpDeliverToVercel(request, env, {
    action,
    email: recipient,
    to: recipient,
    otp,
    purpose: body.purpose || (action === "login_otp" ? "login" : "password_reset"),
  });
}

/** RDS may lack view_count; strip from PostgREST select and default counts in JSON. */
function rewriteSiteBlogPostsRestRequest(request: Request): { request: Request; addViewCount: boolean } {
  const url = new URL(request.url);
  const path = upstreamPath(url.pathname);
  if (path !== "/rest/v1/site_blog_posts" || request.method !== "GET") {
    return { request, addViewCount: false };
  }
  const select = url.searchParams.get("select");
  if (!select || !/\bview_count\b/i.test(select)) {
    return { request, addViewCount: false };
  }
  const stripped = select
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^view_count$/i.test(part))
    .join(",");
  if (stripped === select) return { request, addViewCount: false };
  const next = new URL(url.toString());
  next.searchParams.set("select", stripped || "id");
  return { request: new Request(next.toString(), request), addViewCount: true };
}

async function attachDefaultBlogViewCounts(response: Response): Promise<Response> {
  if (!response.ok) return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return response;
  try {
    const data = (await response.json()) as unknown;
    if (Array.isArray(data)) {
      const body = data.map((row) =>
        row && typeof row === "object"
          ? { ...(row as Record<string, unknown>), view_count: (row as { view_count?: number }).view_count ?? 0 }
          : row
      );
      return Response.json(body, { status: response.status, headers: response.headers });
    }
    if (data && typeof data === "object") {
      const row = data as Record<string, unknown>;
      return Response.json(
        { ...row, view_count: row.view_count ?? 0 },
        { status: response.status, headers: response.headers }
      );
    }
  } catch {
    return response;
  }
  return response;
}

async function proxyToLambda(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const target = buildLambdaTarget(env, url.pathname, url.search);

  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  return fetch(target.toString(), init);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/cyber-cafe/login") {
      return Response.redirect(`${url.origin}/cybercafe/login`, 301);
    }

    if (shouldProxy(url.pathname)) {
      const ensureResponse = await tryProxyEnsureApiToVercel(request, env);
      if (ensureResponse) return ensureResponse;
      const vercelSendMailResponse = await tryHandleVercelSendMailActions(request, env);
      if (vercelSendMailResponse) return vercelSendMailResponse;
      const otpDeliverResponse = await tryHandleOtpDeliver(request, env);
      if (otpDeliverResponse) return otpDeliverResponse;
      const otpResponse = await tryHandleOtpSendMail(request, env);
      if (otpResponse) return otpResponse;
      const blogRest = rewriteSiteBlogPostsRestRequest(request);
      const upstream = await proxyToLambda(blogRest.request, env);
      if (blogRest.addViewCount) return attachDefaultBlogViewCounts(upstream);
      return upstream;
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
