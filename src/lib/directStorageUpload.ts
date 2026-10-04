import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAdminAuthSession } from "@/lib/adminAuthSession";

export async function uploadFileViaPresignedPut(
  client: SupabaseClient,
  input: {
    bucket: string;
    objectKey: string;
    file: File;
  }
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Upload requires a browser session");
  }

  await ensureAdminAuthSession(client, { extendWindow: true, attempts: 2 });
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  if (!token) throw new Error("Sign in again to upload files.");

  const origin = window.location.origin.replace(/\/$/, "");
  const presignRes = await fetch(`${origin}/api/storage-presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucket: input.bucket,
      objectKey: input.objectKey,
      contentType: input.file.type || "application/octet-stream",
    }),
  });

  const presignJson = (await presignRes.json().catch(() => ({}))) as {
    uploadUrl?: string;
    error?: string;
  };

  if (!presignRes.ok || !presignJson.uploadUrl) {
    throw new Error(presignJson.error || `Could not prepare upload (${presignRes.status})`);
  }

  const putRes = await fetch(presignJson.uploadUrl, {
    method: "PUT",
    body: input.file,
    headers: {
      "Content-Type": input.file.type || "application/octet-stream",
    },
  });

  if (!putRes.ok) {
    throw new Error(
      putRes.status === 403
        ? "Upload was blocked by storage (CORS or permissions). Contact support."
        : `Upload to storage failed (${putRes.status}). Retry in a moment.`
    );
  }
}
