import type { SupabaseClient } from "@supabase/supabase-js";

/** Warm RDS validate_student_uniqueness (applies SQL on Lambda when missing). */
export async function warmStudentUniquenessValidation(client?: SupabaseClient): Promise<void> {
  if (typeof window === "undefined") return;

  const { supabase } = await import("@/integrations/supabase/client");
  const db = client ?? supabase;
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  try {
    await db.rpc("student_ensure_uniqueness_schema");
    return;
  } catch {
    /* fall through */
  }

  const origin = window.location.origin.replace(/\/$/, "");
  await fetch(`${origin}/api/ensure-student-uniqueness`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }).catch(() => undefined);
}
