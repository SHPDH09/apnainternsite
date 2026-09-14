import { resolveOtpPurpose, sendOtpViaHostinger, type OtpSmtpEnv } from "./otpMail";

const DEFAULT_RDS_REST =
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging/rest/v1/password_resets";
const DEFAULT_REST_KEY = "local-anon-key";

export type OtpDeliverEnv = OtpSmtpEnv & {
  RDS_REST_URL?: string;
  RDS_ANON_KEY?: string;
};

type OtpDeliverBody = {
  email?: string;
  to?: string;
  purpose?: string;
};

function rdsRestUrl(env: OtpDeliverEnv): string {
  return String(env.RDS_REST_URL || DEFAULT_RDS_REST).trim();
}

function restKey(env: OtpDeliverEnv): string {
  return String(env.RDS_ANON_KEY || DEFAULT_REST_KEY).trim();
}

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

async function storeOtpInRds(env: OtpDeliverEnv, email: string, otp: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const res = await fetch(rdsRestUrl(env), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: restKey(env),
      Authorization: `Bearer ${restKey(env)}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      email,
      otp,
      expires_at: expiresAt,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).trim().slice(0, 240);
    throw new Error(detail || `Could not store OTP (${res.status})`);
  }
}

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

  if (!String(env.SMTP_PASS || "").trim()) {
    return Response.json(
      {
        success: false,
        emailSent: false,
        message:
          "Verification email could not be sent — configure SMTP_PASS on the Cloudflare Worker (SES Mail Manager ingress password).",
      },
      { status: 503, headers: { "X-Otp-Delivery": "edge-unconfigured" } },
    );
  }

  const purpose = resolveOtpPurpose(body.purpose || "login");
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await sendOtpViaHostinger(env, email, otp, purpose);
    await storeOtpInRds(env, email, otp);

    const messageId = `edge-smtp-${crypto.randomUUID()}`;
    return Response.json(
      {
        success: true,
        emailSent: true,
        email,
        channel: "smtp",
        sesSandboxLimited: false,
        message: `Verification code sent to ${email} from info@apnaintern.in. Check Inbox and Spam/Promotions.`,
        messageId,
      },
      { status: 200, headers: { "X-Otp-Delivery": "edge-otp-deliver-smtp" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("edge otp-deliver failed:", msg);
    return Response.json(
      {
        success: false,
        emailSent: false,
        message: msg || "Failed to send verification code",
      },
      { status: 502, headers: { "X-Otp-Delivery": "edge-otp-deliver-error" } },
    );
  }
}
