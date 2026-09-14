import { proxyOtpDeliverToVercel } from "./otpVercelFallback";

type OtpDeliverBody = {
  email?: string;
  to?: string;
  purpose?: string;
};

export type OtpDeliverEnv = {
  VERCEL_MAIL_ORIGIN?: string;
};

function normalizeApiPath(pathname: string): string {
  if (pathname === "/staging" || pathname.startsWith("/staging/")) {
    return pathname.slice("/staging".length) || "/";
  }
  return pathname;
}

function isOtpDeliverPath(pathname: string): boolean {
  const p = normalizeApiPath(pathname);
  return p === "/api/otp-deliver" || p === "/api/request-otp";
}

/**
 * OTP deliver always runs on Vercel (Hostinger SMTP + real messageId + RDS store).
 * Edge SMTP used fake messageIds and could report success without inbox delivery.
 */
export async function tryHandleOtpDeliver(
  request: Request,
  env: OtpDeliverEnv,
): Promise<Response | null> {
  if (request.method !== "POST" || !isOtpDeliverPath(new URL(request.url).pathname)) {
    return null;
  }

  let body: OtpDeliverBody;
  try {
    body = (await request.json()) as OtpDeliverBody;
  } catch {
    return Response.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email || body.to || "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) {
    return Response.json({ success: false, message: "Valid email required" }, { status: 400 });
  }

  return proxyOtpDeliverToVercel(request, env, {
    email,
    purpose: body.purpose || "login",
  });
}
