import { siteApiUrl } from "@/lib/siteApi";

/**
 * Mail uses `/api/send-mail`. Override with `VITE_SEND_MAIL_API_URL`, or set
 * `VITE_SITE_API_ORIGIN` when testing local frontend against AWS Lambda.
 */
export function getSendMailApiUrl(): string {
  if (typeof window === "undefined") return "/api/send-mail";
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
    if (!res.ok) {
      throw new Error(text.trim().slice(0, 280) || `Email request failed (${res.status})`);
    }
    return;
  }

  const detail = (body.error || body.message || "").trim();
  const emailPending =
    body.emailSent === false ||
    Boolean(body.warning) ||
    (Boolean(body.devOtp) && import.meta.env.PROD);

  if (!res.ok || body.success === false || emailPending) {
    throw new Error(detail || `Email request failed (${res.status})`);
  }
}
