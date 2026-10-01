import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { publicStorageObjectUrl, resolveStorageUrl } from "@/lib/storageUrl";

const LOGO_BUCKET = "logos";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type UniversityWithLogo = {
  id: string;
  name: string;
  logo_url: string | null;
};

export async function fetchUniversitiesWithLogos(
  client: SupabaseClient
): Promise<UniversityWithLogo[]> {
  const rows = await fetchAllSupabaseRows<UniversityWithLogo>(client, "universities", {
    select: "id, name, logo_url",
    orderBy: "name",
    ascending: true,
    pageSize: 1000,
  });
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name || ""),
    logo_url: row.logo_url ? String(row.logo_url) : null,
  }));
}

export async function uploadUniversityLogo(
  client: SupabaseClient,
  universityId: string,
  file: File,
  uploadedBy?: string | null
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file (JPG, PNG, WebP, or GIF).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 8 MB or smaller.");
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `universities/${universityId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await client.storage.from(LOGO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (uploadError) {
    if (/bucket not found/i.test(uploadError.message)) {
      throw new Error('Storage bucket "logos" is missing. Run npm run aws:s3:provision.');
    }
    throw uploadError;
  }

  const { data: pub } = client.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const logoUrl =
    publicStorageObjectUrl(LOGO_BUCKET, path) ||
    resolveStorageUrl(pub.publicUrl) ||
    pub.publicUrl;

  const { error: updateError } = await client
    .from("universities")
    .update({ logo_url: logoUrl })
    .eq("id", universityId);
  if (updateError) throw updateError;

  void uploadedBy;
  return logoUrl;
}

export async function removeUniversityLogo(
  client: SupabaseClient,
  universityId: string
): Promise<void> {
  const { error } = await client
    .from("universities")
    .update({ logo_url: null })
    .eq("id", universityId);
  if (error) throw error;
}
