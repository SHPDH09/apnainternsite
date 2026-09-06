import type { PartnerKind } from "@/lib/partnerApplications";

/** True when the partner submit/bootstrap API route is missing or proxied to stale Lambda. */
export function isPartnerSubmitApiUnavailable(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    /404|503|502|504|405|cannot post|not found|failed to fetch|network|method not allowed|function_invocation|<!doctype html>|staging\/api\//i.test(
      msg
    )
  );
}

export async function submitPartnerApplicationViaApi(
  accessToken: string,
  input: {
    partner_kind: PartnerKind;
    full_name: string;
    email: string;
    contact_number: string;
    payload: Record<string, unknown>;
  }
): Promise<string> {
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  if (!origin) {
    throw new Error("Partner application API is unavailable in this environment.");
  }

  const res = await fetch(`${origin}/api/partner-application-submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const text = await res.text().catch(() => "");
  let body: { ok?: boolean; id?: string; message?: string; detail?: string } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    body = { message: text.trim().slice(0, 280) || `Request failed (${res.status})` };
  }

  if (!res.ok || body.ok !== true || !body.id) {
    const errMsg = body.message || body.detail || `Partner application failed (${res.status})`;
    if (isPartnerSubmitApiUnavailable(errMsg) || isPartnerSubmitApiUnavailable(text)) {
      throw new Error(`Cannot POST /api/partner-application-submit (${res.status})`);
    }
    throw new Error(errMsg);
  }

  return body.id;
}

export async function readAccessTokenFromClient(
  client: { auth: { getSession: () => Promise<{ data: { session: { access_token?: string } | null } }> } }
): Promise<string | null> {
  try {
    const { data } = await client.auth.getSession();
    return data.session?.access_token?.trim() || null;
  } catch {
    return null;
  }
}
