import { supabase } from "@/integrations/supabase/client";

/** Warm RDS validate_student_uniqueness via Vercel (applies migration 20260726120000 if needed). */
export async function warmStudentUniquenessValidation(): Promise<void> {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  const origin = window.location.origin.replace(/\/$/, "");
  await fetch(`${origin}/api/student-uniqueness`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: data.session?.user?.email || "warmup@invalid.local",
      excludeUserId: data.session?.user?.id,
    }),
  }).catch(() => undefined);
}
