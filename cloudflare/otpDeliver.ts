import { proxyOtpDeliverToVercel } from "./otpVercelFallback";

export type OtpDeliverEnv = {
  RDS_REST_URL?: string;
  RDS_ANON_KEY?: string;
  VERCEL_MAIL_ORIGIN?: string;
};

type OtpDeliverBody = {
  email?: string;
  to?: string;
  purpose?: string;
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
 * OTP delivery runs on Vercel with Amazon SES SMTP (real inbox delivery).
 * Edge Mail Manager accepted mail but never delivered — do not send from the Worker.
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

  const purpose = String(body.purpose || "login").trim();

  try {
    return await proxyOtpDeliverToVercel(request, env, { email, purpose });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        success: false,
        emailSent: false,
        message: msg || "Failed to send verification code",
      },
      { status: 502, headers: { "X-Otp-Delivery": "vercel-relay-error" } },
    );
  }
}
