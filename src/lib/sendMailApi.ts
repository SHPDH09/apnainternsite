import { siteApiUrl } from "@/lib/siteApi";

/**
 * Mail uses `/api/send-mail`. Override with `VITE_SEND_MAIL_API_URL`, or set
 * `VITE_SITE_API_ORIGIN` when testing local frontend against AWS Lambda.
 */
export function getSendMailApiUrl(): string {
  if (typeof window === "undefined") return "/api/send-mail";
  const host = window.location.hostname.toLowerCase();
  if (host.includes("ezyintern") || host === "www.apnaintern.in") {
    return "https://apnaintern.in/api/send-mail";
  }
  const fromEnv = import.meta.env.VITE_SEND_MAIL_API_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  return siteApiUrl("/api/send-mail");
}

type SendMailJson = {
  success?: boolean;
  emailSent?: boolean;
  message?: string;
  error?: string;
  warning?: string;
  devOtp?: string;
};

export async function assertSendMailOk(res: Response): Promise<void> {
  const text = await res.text().catch(() => "");
  let body: SendMailJson = {};
  try {
    body = JSON.parse(text) as SendMailJson;
  } catch {
    const snippet = text.trim().slice(0, 280);
    throw new Error(
      snippet.includes("FUNCTION_INVOCATION_FAILED")
        ? "Email server error — mail could not be sent. Try again in a minute or use https://apnaintern.in"
        : snippet || `Email request failed (${res.status})`
    );
  }

  const detail = (body.error || body.message || "").trim();
  const emailPending =
    body.emailSent !== true ||
    Boolean(body.warning) ||
    (Boolean(body.devOtp) && import.meta.env.PROD);

  if (!res.ok || body.success !== true || emailPending) {
    throw new Error(detail || `Email request failed (${res.status})`);
  }
}
