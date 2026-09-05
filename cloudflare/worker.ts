/**
 * Cloudflare Worker — proxy /auth, /rest, /storage, /functions, /api to AWS Lambda.
 * OTP mail (login_otp / send_otp) is sent at the edge via Hostinger SMTP when configured,
 * so login works even when Lambda still has broken SES/SMTP env.
 */

import { buildOtpMailHtml, resolveOtpPurpose, sendOtpViaHostinger } from "./otpMail";

export interface Env {
  ASSETS: Fetcher;
  LAMBDA_ORIGIN: string;
  LAMBDA_STAGE?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAIL_FROM_ADDRESS?: string;
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

async function tryMailchannelsOtp(
  to: string,
  otp: string,
  purpose: ReturnType<typeof resolveOtpPurpose>,
  request: Request,
): Promise<Response | null> {
  void request;
  const mail = buildOtpMailHtml(otp, purpose);
  const fromAddress = "info@apnaintern.in";
  try {
    const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromAddress, name: "Apna Intern" },
        subject: mail.subject,
        content: [{ type: "text/html", value: mail.html }],
      }),
    });
    if (res.ok) {
      return Response.json(
        { success: true, emailSent: true, message: "Email sent successfully!", via: "mailchannels" },
        { status: 200, headers: { "X-Otp-Delivery": "mailchannels" } },
      );
    }
    console.warn("mailchannels OTP failed", res.status, await res.text());
  } catch (e) {
    console.warn("mailchannels OTP error", e);
  }
  return null;
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
  if (action !== "login_otp" && action !== "send_otp") {
    return null;
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

  if (!String(env.SMTP_PASS || "").trim()) {
    const mc = await tryMailchannelsOtp(recipient, otp, purpose, request);
    if (mc) return mc;
    return null;
  }

  const purpose = resolveOtpPurpose(
    body.purpose || (action === "login_otp" ? "login" : "password_reset"),
  );

  try {
    await sendOtpViaHostinger(env, recipient, otp, purpose);
    return Response.json(
      {
        success: true,
        emailSent: true,
        message: "Email sent successfully!",
        via: "cloudflare-edge-smtp",
      },
      {
        status: 200,
        headers: { "X-Otp-Delivery": "edge-smtp" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("edge OTP mail failed:", msg);
    return Response.json(
      {
        success: false,
        emailSent: false,
        message: "Failed to send verification email",
        error: msg,
      },
      { status: 502, headers: { "X-Otp-Delivery": "edge-smtp-error" } },
    );
  }
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
      const otpResponse = await tryHandleOtpSendMail(request, env);
      if (otpResponse) return otpResponse;
      return proxyToLambda(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
