import type { SupabaseClient } from "@supabase/supabase-js";

type PurgePayload = {
  ok?: boolean;
  deleted?: boolean;
  user_id?: string;
  error?: string;
};

/** Permanently delete a user (auth + students + related rows). Not a soft delete. */
export async function purgeStudentPermanently(
  client: SupabaseClient,
  userId: string
): Promise<void> {
  const id = String(userId || "").trim();
  if (!id) throw new Error("User id is required");

  const { data, error } = await client.rpc("admin_purge_student", { p_user_id: id });
  if (error) throw error;

  const payload = (data || {}) as PurgePayload;
  if (payload.ok !== true || payload.deleted !== true) {
    throw new Error("User account was not fully deleted. Apply the admin_purge_student migration.");
  }
}
