/**
 * Cloudflare Worker — proxy /auth, /rest, /storage, /functions, /api to AWS Lambda.
 * OTP mail is relayed to Vercel (/api/otp-deliver) for Amazon SES SMTP delivery.
 */

import { tryHandleOtpDeliver } from "./otpDeliver";
import { resolveOtpPurpose } from "./otpMail";
import { proxyOtpDeliverToVercel } from "./otpVercelFallback";

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
      const otpDeliverResponse = await tryHandleOtpDeliver(request, env);
      if (otpDeliverResponse) return otpDeliverResponse;
      const otpResponse = await tryHandleOtpSendMail(request, env);
      if (otpResponse) return otpResponse;
      return proxyToLambda(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
