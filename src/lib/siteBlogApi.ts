import type { SupabaseClient } from "@supabase/supabase-js";
import { publicStorageObjectUrl, resolveStorageUrl } from "@/lib/storageUrl";

const BLOG_BUCKET = "logos";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type SiteBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  author_name?: string | null;
  published_at?: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SiteBlogPostInput = {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content: string;
  author_name?: string | null;
  published_at?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  sort_order?: number;
};

function mapCoverUrl(row: SiteBlogPost): SiteBlogPost {
  const fromPath =
    row.cover_image_path != null && String(row.cover_image_path).trim() !== ""
      ? publicStorageObjectUrl(BLOG_BUCKET, String(row.cover_image_path))
      : null;
  return {
    ...row,
    cover_image_url:
      fromPath ||
      (row.cover_image_url ? resolveStorageUrl(row.cover_image_url) || row.cover_image_url : null),
  };
}

function sortBlogPosts(rows: SiteBlogPost[]): SiteBlogPost[] {
  return [...rows].sort((a, b) => {
    const featured = Number(b.is_featured) - Number(a.is_featured);
    if (featured !== 0) return featured;
    const sort = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sort !== 0) return sort;
    const pub = String(b.published_at || b.created_at || "").localeCompare(
      String(a.published_at || a.created_at || "")
    );
    if (pub !== 0) return pub;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

export function slugifyBlogTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureUniqueSlug(
  client: SupabaseClient,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug || "post";
  let suffix = 0;
  while (suffix < 100) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    let query = client.from("site_blog_posts").select("id").eq("slug", candidate).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return candidate;
    suffix += 1;
  }
  return `${slug}-${Date.now()}`;
}

export async function fetchPublicBlogPosts(
  client: SupabaseClient,
  opts?: { featuredOnly?: boolean; limit?: number }
): Promise<SiteBlogPost[]> {
  let query = client
    .from("site_blog_posts")
    .select(
      "id, title, slug, excerpt, content, cover_image_url, cover_image_path, author_name, published_at, is_active, is_featured, sort_order, created_at, updated_at"
    )
    .eq("is_active", true);

  if (opts?.featuredOnly) query = query.eq("is_featured", true);

  const { data, error } = await query;
  if (error) throw error;

  let rows = sortBlogPosts(((data || []) as SiteBlogPost[]).map(mapCoverUrl));
  if (opts?.limit && opts.limit > 0) rows = rows.slice(0, opts.limit);
  return rows;
}

export async function fetchPublicBlogPostBySlug(
  client: SupabaseClient,
  slug: string
): Promise<SiteBlogPost | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await client
    .from("site_blog_posts")
    .select(
      "id, title, slug, excerpt, content, cover_image_url, cover_image_path, author_name, published_at, is_active, is_featured, sort_order, created_at, updated_at"
    )
    .eq("is_active", true)
    .eq("slug", normalized)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapCoverUrl(data as SiteBlogPost);
}

export async function fetchAdminBlogPosts(client: SupabaseClient): Promise<SiteBlogPost[]> {
  const { data, error } = await client
    .from("site_blog_posts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return sortBlogPosts(((data || []) as SiteBlogPost[]).map(mapCoverUrl));
}

export async function createBlogPost(
  client: SupabaseClient,
  createdBy: string,
  input: SiteBlogPostInput
): Promise<SiteBlogPost> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const content = input.content.trim();
  if (!content) throw new Error("Content is required.");

  const baseSlug = slugifyBlogTitle(input.slug?.trim() || title);
  const slug = await ensureUniqueSlug(client, baseSlug);
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("site_blog_posts")
    .insert({
      title,
      slug,
      excerpt: input.excerpt?.trim() || null,
      content,
      author_name: input.author_name?.trim() || "Apna Intern",
      published_at: input.published_at || now,
      is_active: input.is_active !== false,
      is_featured: input.is_featured === true,
      sort_order: input.sort_order ?? 0,
      created_by: createdBy && /^[0-9a-f-]{36}$/i.test(createdBy) ? createdBy : null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapCoverUrl(data as SiteBlogPost);
}

export async function updateBlogPost(
  client: SupabaseClient,
  id: string,
  patch: Partial<SiteBlogPostInput> & {
    cover_image_url?: string | null;
    cover_image_path?: string | null;
  }
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.excerpt !== undefined) payload.excerpt = patch.excerpt?.trim() || null;
  if (patch.content !== undefined) payload.content = patch.content.trim();
  if (patch.author_name !== undefined) payload.author_name = patch.author_name?.trim() || null;
  if (patch.published_at !== undefined) payload.published_at = patch.published_at;
  if (patch.is_active !== undefined) payload.is_active = patch.is_active;
  if (patch.is_featured !== undefined) payload.is_featured = patch.is_featured;
  if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order;
  if (patch.cover_image_url !== undefined) payload.cover_image_url = patch.cover_image_url;
  if (patch.cover_image_path !== undefined) payload.cover_image_path = patch.cover_image_path;

  if (patch.slug !== undefined || patch.title !== undefined) {
    const base = slugifyBlogTitle(patch.slug?.trim() || String(patch.title || ""));
    if (base) payload.slug = await ensureUniqueSlug(client, base, id);
  }

  const { error } = await client.from("site_blog_posts").update(payload).eq("id", id);
  if (error) throw error;
}

export async function uploadBlogCoverImage(
  client: SupabaseClient,
  postId: string,
  file: File
): Promise<{ cover_image_url: string; cover_image_path: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file (JPG, PNG, WebP, etc.).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Cover image must be 8 MB or smaller.");
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `blog/${postId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await client.storage.from(BLOG_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (upErr) {
    if (/bucket not found/i.test(upErr.message)) {
      throw new Error('Storage bucket "logos" is missing. Run npm run aws:s3:provision.');
    }
    throw upErr;
  }

  const { data: pub } = client.storage.from(BLOG_BUCKET).getPublicUrl(path);
  const cover_image_url =
    publicStorageObjectUrl(BLOG_BUCKET, path) ||
    resolveStorageUrl(pub.publicUrl) ||
    pub.publicUrl;

  await updateBlogPost(client, postId, { cover_image_url, cover_image_path: path });
  return { cover_image_url, cover_image_path: path };
}

export async function deleteBlogPost(client: SupabaseClient, row: SiteBlogPost): Promise<void> {
  if (row.cover_image_path) {
    await client.storage.from(BLOG_BUCKET).remove([row.cover_image_path]);
  }
  const { error } = await client.from("site_blog_posts").delete().eq("id", row.id);
  if (error) throw error;
}

export function formatBlogDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
