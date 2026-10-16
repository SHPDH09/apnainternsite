import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAdminAuthSession } from "@/lib/adminAuthSession";

async function uploadViaStorageApi(
  client: SupabaseClient,
  input: { bucket: string; objectKey: string; file: File }
): Promise<void> {
  const contentType = input.file.type || "application/octet-stream";
  let lastMessage = "Storage upload failed.";
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await client.storage.from(input.bucket).upload(input.objectKey, input.file, {
      upsert: attempt > 0,
      contentType,
    });
    if (!error) return;
    lastMessage = error.message || lastMessage;
    if (!/503|502|504|timeout|unavailable|FUNCTION_INVOCATION/i.test(error.message)) break;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  if (/bucket not found/i.test(lastMessage)) {
    throw new Error(`Storage bucket "${input.bucket}" is missing. Contact support.`);
  }
  throw new Error(lastMessage || "Storage upload failed. Please retry in a moment.");
}

async function uploadViaPresignedPut(
  client: SupabaseClient,
  input: { bucket: string; objectKey: string; file: File }
): Promise<void> {
  await ensureAdminAuthSession(client, { extendWindow: true, attempts: 2 });
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  if (!token) throw new Error("Sign in again to upload files.");

  const origin = window.location.origin.replace(/\/$/, "");
  const presignController = new AbortController();
  const presignTimer = setTimeout(() => presignController.abort(), 25_000);
  let presignRes: Response;
  try {
    presignRes = await fetch(`${origin}/api/storage-presign`, {
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
      signal: presignController.signal,
    });
  } finally {
    clearTimeout(presignTimer);
  }

  const presignJson = (await presignRes.json().catch(() => ({}))) as {
    uploadUrl?: string;
    error?: string;
  };

  if (!presignRes.ok || !presignJson.uploadUrl) {
    throw new Error(presignJson.error || `Could not prepare upload (${presignRes.status})`);
  }

  const putController = new AbortController();
  const putTimer = setTimeout(() => putController.abort(), 120_000);
  let putRes: Response;
  try {
    putRes = await fetch(presignJson.uploadUrl, {
      method: "PUT",
      body: input.file,
      headers: {
        "Content-Type": input.file.type || "application/octet-stream",
      },
      signal: putController.signal,
    });
  } finally {
    clearTimeout(putTimer);
  }

  if (!putRes.ok) {
    throw new Error(
      putRes.status === 403
        ? "Upload was blocked by storage (CORS or permissions). Contact support."
        : `Upload to storage failed (${putRes.status}). Retry in a moment.`
    );
  }
}

/**
 * Upload to S3 via presigned PUT when available; falls back to the storage API
 * (same path as legacy uploads) so admin Uploads / project reports keep working
 * when presign or direct PUT fails.
 */
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

  try {
    await uploadViaPresignedPut(client, input);
    return;
  } catch (presignErr) {
    const msg = presignErr instanceof Error ? presignErr.message : String(presignErr);
    if (/sign in again/i.test(msg)) throw presignErr;
    console.warn("[storage] presigned upload failed, using storage API fallback:", msg);
  }

  await uploadViaStorageApi(client, input);
}
