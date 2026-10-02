import { supabase } from "@/integrations/supabase/client";
import { siteApiUrl } from "@/lib/siteApi";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchWaCrmBootstrap() {
  const res = await fetch(siteApiUrl("/api/wa-crm/bootstrap"), {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new Error("Could not load WA CRM data");
  }
  return res.json();
}

export async function fetchWaCrmMessages(conversationId: string) {
  const res = await fetch(siteApiUrl(`/api/wa-crm/conversations/${conversationId}/messages`), {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Could not load messages");
  return res.json() as Promise<{ messages: unknown[] }>;
}

export async function sendWaCrmMessage(input: { to: string; body: string; conversationId?: string }) {
  const res = await fetch(siteApiUrl("/api/wa-crm/messages/send"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function suggestAiReply(message: string) {
  const res = await fetch(siteApiUrl("/api/wa-crm/ai/suggest-reply"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("AI suggest failed");
  return res.json() as Promise<{ text: string; confidence: number }>;
}
