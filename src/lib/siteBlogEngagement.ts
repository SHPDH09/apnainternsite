import type { SupabaseClient } from "@supabase/supabase-js";
import { apiUrl } from "@/lib/siteApi";
import { supabase } from "@/integrations/supabase/client";

const LEAD_DONE_PREFIX = "apna_blog_lead_v1:";
const VIEW_SESSION_PREFIX = "apna_blog_view_v1:";

type BlogInteractionAction =
  | "increment_view"
  | "get_view"
  | "submit_lead"
  | "lookup_phone";

const SEND_MAIL_BLOG_ACTION: Record<BlogInteractionAction, string> = {
  increment_view: "blog_increment_view",
  get_view: "blog_get_view",
  submit_lead: "blog_submit_lead",
  lookup_phone: "blog_lookup_phone",
};

async function postBlogViaSendMail(
  action: BlogInteractionAction,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl("/api/send-mail"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: SEND_MAIL_BLOG_ACTION[action], ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(json.message || json.error || `HTTP ${res.status}`));
  }
  return json;
}

async function postBlogInteraction(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const action = String(body.action || "").trim() as BlogInteractionAction;
  try {
    return await postBlogViaSendMail(action, body);
  } catch {
    const res = await fetch(apiUrl("/api/blog-interaction"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(json.message || `HTTP ${res.status}`));
    }
    return json;
  }
}

async function rpcFallback(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export function blogLeadAlreadySubmitted(postId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`${LEAD_DONE_PREFIX}${postId}`) === "1";
}

export function markBlogLeadSubmitted(postId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${LEAD_DONE_PREFIX}${postId}`, "1");
}

export function blogViewRecordedThisSession(postId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(`${VIEW_SESSION_PREFIX}${postId}`) === "1";
}

export function markBlogViewRecorded(postId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${VIEW_SESSION_PREFIX}${postId}`, "1");
}

export async function incrementBlogPostView(postId: string): Promise<number> {
  try {
    const json = await postBlogInteraction({ action: "increment_view", post_id: postId });
    return Number(json.view_count ?? 0);
  } catch {
    try {
      const count = await rpcFallback("public_increment_blog_post_view", { p_post_id: postId });
      return Number(count ?? 0);
    } catch {
      return 0;
    }
  }
}

export async function fetchBlogPostViewCount(postId: string): Promise<number> {
  try {
    const json = await postBlogInteraction({ action: "get_view", post_id: postId });
    return Number(json.view_count ?? 0);
  } catch {
    return 0;
  }
}

export async function submitBlogReaderLead(input: {
  postId: string;
  fullName: string;
  email: string;
  phone: string;
  collegeName?: string;
}): Promise<void> {
  const payload = {
    action: "submit_lead" as BlogInteractionAction,
    post_id: input.postId,
    full_name: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    college_name: input.collegeName?.trim() || "",
  };
  try {
    await postBlogInteraction(payload);
    return;
  } catch {
    await rpcFallback("public_submit_site_blog_lead", {
      p_post_id: input.postId,
      p_full_name: payload.full_name,
      p_email: payload.email,
      p_phone: payload.phone,
      p_college_name: payload.college_name || null,
    });
  }
}

export type BlogLeadAutofillProfile = {
  full_name: string;
  email: string;
  college_name: string;
};

export async function lookupBlogLeadAutofillByPhone(phone: string): Promise<BlogLeadAutofillProfile> {
  const empty = { full_name: "", email: "", college_name: "" };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return empty;
  try {
    const json = await postBlogInteraction({ action: "lookup_phone", phone: digits });
    const profile = (json.profile || {}) as Record<string, unknown>;
    return {
      full_name: String(profile.full_name || "").trim(),
      email: String(profile.email || "").trim(),
      college_name: String(profile.college_name || "").trim(),
    };
  } catch {
    try {
      const raw = await rpcFallback("public_lookup_blog_lead_autofill", { p_phone: digits });
      const profile = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        full_name: String(profile.full_name || "").trim(),
        email: String(profile.email || "").trim(),
        college_name: String(profile.college_name || "").trim(),
      };
    } catch {
      return empty;
    }
  }
}

/** Prefill from logged-in student profile when available. */
export async function loadStudentBlogAutofill(client: SupabaseClient): Promise<BlogLeadAutofillProfile> {
  const empty = { full_name: "", email: "", college_name: "" };
  try {
    const { data: sessionData } = await client.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return empty;
    const { data, error } = await client
      .from("students")
      .select("full_name, email, contact_number, college_name")
      .eq("id", uid)
      .maybeSingle();
    if (error || !data) return empty;
    return {
      full_name: String(data.full_name || "").trim(),
      email: String(data.email || sessionData.session?.user?.email || "").trim(),
      college_name: String(data.college_name || "").trim(),
    };
  } catch {
    return empty;
  }
}
