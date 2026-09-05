import type { SupabaseClient } from "@supabase/supabase-js";
import { publicStorageObjectUrl, resolveStorageUrl } from "@/lib/storageUrl";
import {
  createFallbackBlogPost,
  deleteFallbackBlogPost,
  fetchFallbackAdminBlogPosts,
  fetchFallbackPublicBlogPosts,
  findFallbackBlogPostById,
  isSiteBlogTableMissingError,
  siteBlogFallbackAvailable,
  siteBlogTableAvailable,
  resetSiteBlogStorageCache,
  updateFallbackBlogPost,
} from "@/lib/siteBlogFallbackStorage";

const BLOG_BUCKET = "logos";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function blogErrorText(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    return [e.message, e.details, e.hint, e.code].filter(Boolean).join(" — ");
  }
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isSiteBlogTableMissing(error: unknown): boolean {
  return isSiteBlogTableMissingError(error);
}

export function formatSiteBlogError(error: unknown): string {
  if (isSiteBlogTableMissing(error)) {
    return "Blog table is not ready yet — saving to cloud storage instead. Retry if Save fails.";
  }
  const msg = blogErrorText(error);
  if (/row-level security|42501/i.test(msg)) {
    return "Permission denied — sign out, sign in again as admin, then retry Save.";
  }
  if (/foreign key|23503/i.test(msg) && /created_by/i.test(msg)) {
    return "Could not link author record. Retry Save — this has been fixed server-side.";
  }
  if (/duplicate key|23505/i.test(msg) && /slug/i.test(msg)) {
    return "This URL slug is already used. Change the slug and save again.";
  }
  if (/DATABASE_URL|ensure-blog-cms|503|Lambda blog bootstrap/i.test(msg)) {
    return "Blog cloud storage is unavailable. Check your connection and retry Save.";
  }
  return msg || "Blog save failed.";
}

/** Ensure blog storage — RDS table preferred; S3 JSON fallback when table bootstrap unavailable. */
export async function ensureSiteBlogStorage(client: SupabaseClient): Promise<void> {
  if (await siteBlogTableAvailable(client)) return;

  // S3 JSON fallback works without RDS bootstrap — use it when available.
  resetSiteBlogStorageCache();
  if (await siteBlogFallbackAvailable(client)) return;

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";

  const bootstrapErrors: string[] = [];

  const recheckTable = async (): Promise<boolean> => {
    resetSiteBlogStorageCache();
    return siteBlogTableAvailable(client);
  };

  if (token) {
    try {
      const { error } = await client.rpc("admin_ensure_site_cms_tables");
      if (!error) {
        await new Promise((r) => setTimeout(r, 500));
        if (await recheckTable()) return;
      } else {
        bootstrapErrors.push(blogErrorText(error));
      }
    } catch (err) {
      bootstrapErrors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (token && typeof fetch !== "undefined") {
    for (const [label, url, body] of [
      ["ensure-blog-cms", `${origin}/api/ensure-blog-cms`, undefined],
      [
        "send-mail ensure_blog_cms",
        `${origin}/api/send-mail`,
        JSON.stringify({ action: "ensure_blog_cms" }),
      ],
    ] as const) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body } : {}),
        });
        if (res.ok) {
          await new Promise((r) => setTimeout(r, 600));
          if (await recheckTable()) return;
        } else {
          const json = (await res.json().catch(() => ({}))) as { message?: string };
          bootstrapErrors.push(json.message || `${label} HTTP ${res.status}`);
        }
      } catch (err) {
        bootstrapErrors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  if (await recheckTable()) return;
  resetSiteBlogStorageCache();
  if (await siteBlogFallbackAvailable(client)) return;

  throw new Error(
    bootstrapErrors.join("; ") ||
      "Blog storage is unavailable. Retry Save in a moment."
  );
}

async function withBlogStorageRetry<T>(
  client: SupabaseClient,
  run: () => Promise<T>
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      if (attempt > 0) {
        await ensureSiteBlogStorage(client);
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
      return await run();
    } catch (err) {
      lastErr = err;
      if (!isSiteBlogTableMissing(err)) throw err;
      await ensureSiteBlogStorage(client);
    }
  }
  throw lastErr;
}

export type BlogPostStatus = "draft" | "scheduled" | "published";
export type BlogPostType = "blog" | "vlog";

export type SiteBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  author_name?: string | null;
  post_type: BlogPostType;
  status: BlogPostStatus;
  published_at?: string | null;
  scheduled_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  tags?: string[] | null;
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
  post_type?: BlogPostType;
  status?: BlogPostStatus;
  published_at?: string | null;
  scheduled_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  tags?: string[] | null;
  is_active?: boolean;
  is_featured?: boolean;
  sort_order?: number;
};

const BLOG_SELECT =
  "id, title, slug, excerpt, content, cover_image_url, cover_image_path, author_name, post_type, status, published_at, scheduled_at, meta_title, meta_description, tags, is_active, is_featured, sort_order, created_by, created_at, updated_at";

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  return [];
}

function mapCoverUrl(row: SiteBlogPost): SiteBlogPost {
  const fromPath =
    row.cover_image_path != null && String(row.cover_image_path).trim() !== ""
      ? publicStorageObjectUrl(BLOG_BUCKET, String(row.cover_image_path))
      : null;
  return {
    ...row,
    tags: normalizeTags(row.tags),
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
    const pub = String(b.published_at || b.scheduled_at || b.created_at || "").localeCompare(
      String(a.published_at || a.scheduled_at || a.created_at || "")
    );
    if (pub !== 0) return pub;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

/** Whether a post should appear on the public site right now. */
export function isBlogPostPublic(post: SiteBlogPost, now = new Date()): boolean {
  if (!post.is_active) return false;
  if (post.status === "draft") return false;
  const ts = now.getTime();
  if (post.status === "scheduled") {
    if (!post.scheduled_at) return false;
    return new Date(post.scheduled_at).getTime() <= ts;
  }
  if (post.status === "published") {
    if (post.published_at && new Date(post.published_at).getTime() > ts) return false;
    return true;
  }
  return false;
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

export function estimateReadMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
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
    if (!(await siteBlogTableAvailable(client))) {
      const rows = await fetchFallbackAdminBlogPosts(client);
      if (!rows.some((r) => r.slug === candidate && r.id !== excludeId)) return candidate;
    } else {
      let query = client.from("site_blog_posts").select("id").eq("slug", candidate).limit(1);
      if (excludeId) query = query.neq("id", excludeId);
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) return candidate;
    }
    suffix += 1;
  }
  return `${slug}-${Date.now()}`;
}

export async function fetchPublicBlogPosts(
  client: SupabaseClient,
  opts?: { featuredOnly?: boolean; limit?: number; postType?: BlogPostType }
): Promise<SiteBlogPost[]> {
  await ensureSiteBlogStorage(client);

  let fallbackRows = sortBlogPosts((await fetchFallbackPublicBlogPosts(client)).map(mapCoverUrl)).filter(
    isBlogPostPublic
  );

  if (!(await siteBlogTableAvailable(client))) {
    if (opts?.featuredOnly) fallbackRows = fallbackRows.filter((p) => p.is_featured);
    if (opts?.postType) fallbackRows = fallbackRows.filter((p) => p.post_type === opts.postType);
    if (opts?.limit && opts.limit > 0) fallbackRows = fallbackRows.slice(0, opts.limit);
    return fallbackRows;
  }

  let query = client.from("site_blog_posts").select(BLOG_SELECT).eq("is_active", true);
  if (opts?.featuredOnly) query = query.eq("is_featured", true);
  if (opts?.postType) query = query.eq("post_type", opts.postType);

  try {
    const { data, error } = await withBlogStorageRetry(client, () => query);
    if (error) throw error;
    let rows = mergeBlogPostsById(fallbackRows, sortBlogPosts(((data || []) as SiteBlogPost[]).map(mapCoverUrl))).filter(
      isBlogPostPublic
    );
    if (opts?.featuredOnly) rows = rows.filter((p) => p.is_featured);
    if (opts?.postType) rows = rows.filter((p) => p.post_type === opts.postType);
    if (opts?.limit && opts.limit > 0) rows = rows.slice(0, opts.limit);
    return rows;
  } catch (err) {
    if (isSiteBlogTableMissing(err)) {
      resetSiteBlogStorageCache();
      if (opts?.featuredOnly) fallbackRows = fallbackRows.filter((p) => p.is_featured);
      if (opts?.postType) fallbackRows = fallbackRows.filter((p) => p.post_type === opts.postType);
      if (opts?.limit && opts.limit > 0) fallbackRows = fallbackRows.slice(0, opts.limit);
      return fallbackRows;
    }
    throw err;
  }
}

export async function fetchPublicBlogPostBySlug(
  client: SupabaseClient,
  slug: string
): Promise<SiteBlogPost | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  await ensureSiteBlogStorage(client);
  if (!(await siteBlogTableAvailable(client))) {
    const post = (await fetchFallbackPublicBlogPosts(client))
      .map(mapCoverUrl)
      .find((p) => p.slug.toLowerCase() === normalized);
    return post && isBlogPostPublic(post) ? post : null;
  }

  const { data, error } = await withBlogStorageRetry(client, () =>
    client
      .from("site_blog_posts")
      .select(BLOG_SELECT)
      .eq("is_active", true)
      .eq("slug", normalized)
      .maybeSingle()
  );

  if (error) throw error;
  if (!data) return null;
  const post = mapCoverUrl(data as SiteBlogPost);
  return isBlogPostPublic(post) ? post : null;
}

async function locateBlogPost(
  client: SupabaseClient,
  id: string
): Promise<"rds" | "fallback" | null> {
  resetSiteBlogStorageCache();
  if (await siteBlogTableAvailable(client)) {
    const { data, error } = await client.from("site_blog_posts").select("id").eq("id", id).maybeSingle();
    if (error && !isSiteBlogTableMissing(error)) throw error;
    if (data?.id) return "rds";
  }
  const fallback = await findFallbackBlogPostById(client, id);
  if (fallback) return "fallback";
  return null;
}

async function fetchRdsAdminBlogPosts(client: SupabaseClient): Promise<SiteBlogPost[]> {
  const { data, error } = await withBlogStorageRetry(client, () =>
    client.from("site_blog_posts").select("*").order("updated_at", { ascending: false })
  );
  if (error) throw error;
  return ((data || []) as SiteBlogPost[]).map(mapCoverUrl);
}

function mergeBlogPostsById(...groups: SiteBlogPost[][]): SiteBlogPost[] {
  const byId = new Map<string, SiteBlogPost>();
  for (const group of groups) {
    for (const row of group) {
      const existing = byId.get(row.id);
      if (!existing) {
        byId.set(row.id, row);
        continue;
      }
      const existingTs = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const nextTs = new Date(row.updated_at || row.created_at || 0).getTime();
      if (nextTs >= existingTs) byId.set(row.id, row);
    }
  }
  return sortBlogPosts([...byId.values()]);
}

export async function fetchAdminBlogPosts(client: SupabaseClient): Promise<SiteBlogPost[]> {
  await ensureSiteBlogStorage(client);

  const fallbackRows = sortBlogPosts((await fetchFallbackAdminBlogPosts(client)).map(mapCoverUrl));
  if (!(await siteBlogTableAvailable(client))) {
    return fallbackRows;
  }

  try {
    const rdsRows = await fetchRdsAdminBlogPosts(client);
    return mergeBlogPostsById(fallbackRows, rdsRows);
  } catch (err) {
    if (isSiteBlogTableMissing(err)) {
      resetSiteBlogStorageCache();
      return fallbackRows;
    }
    throw err;
  }
}

function resolvePublishFields(input: SiteBlogPostInput): {
  status: BlogPostStatus;
  published_at: string | null;
  scheduled_at: string | null;
} {
  const status = input.status || "draft";
  if (status === "published") {
    return {
      status: "published",
      published_at: input.published_at || new Date().toISOString(),
      scheduled_at: null,
    };
  }
  if (status === "scheduled") {
    return {
      status: "scheduled",
      published_at: null,
      scheduled_at: input.scheduled_at || null,
    };
  }
  return { status: "draft", published_at: null, scheduled_at: null };
}

export async function createBlogPost(
  client: SupabaseClient,
  _createdBy: string,
  input: SiteBlogPostInput
): Promise<SiteBlogPost> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const content = input.content.trim();
  if (!content) throw new Error("Content is required.");

  const baseSlug = slugifyBlogTitle(input.slug?.trim() || title);
  const slug = await ensureUniqueSlug(client, baseSlug);
  const now = new Date().toISOString();
  const publish = resolvePublishFields(input);

  await ensureSiteBlogStorage(client);

  if (!(await siteBlogTableAvailable(client))) {
    const created = await createFallbackBlogPost(client, {
      id: crypto.randomUUID(),
      title,
      slug,
      excerpt: input.excerpt?.trim() || null,
      content,
      author_name: input.author_name?.trim() || "Apna Intern",
      post_type: input.post_type || "blog",
      status: publish.status,
      published_at: publish.published_at,
      scheduled_at: publish.scheduled_at,
      meta_title: input.meta_title?.trim() || null,
      meta_description: input.meta_description?.trim() || null,
      tags: normalizeTags(input.tags),
      is_active: input.is_active !== false,
      is_featured: input.is_featured === true,
      sort_order: input.sort_order ?? 0,
      created_by: null,
      created_at: now,
      updated_at: now,
    });
    return mapCoverUrl(created);
  }

  const { data, error } = await withBlogStorageRetry(client, () =>
    client
      .from("site_blog_posts")
      .insert({
        title,
        slug,
        excerpt: input.excerpt?.trim() || null,
        content,
        author_name: input.author_name?.trim() || "Apna Intern",
        post_type: input.post_type || "blog",
        status: publish.status,
        published_at: publish.published_at,
        scheduled_at: publish.scheduled_at,
        meta_title: input.meta_title?.trim() || null,
        meta_description: input.meta_description?.trim() || null,
        tags: normalizeTags(input.tags),
        is_active: input.is_active !== false,
        is_featured: input.is_featured === true,
        sort_order: input.sort_order ?? 0,
        // Plain uuid column (no FK) — avoids save failures when auth.users row is absent.
        created_by: null,
        updated_at: now,
      })
      .select("*")
      .single()
  );

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
  if (patch.post_type !== undefined) payload.post_type = patch.post_type;
  if (patch.meta_title !== undefined) payload.meta_title = patch.meta_title?.trim() || null;
  if (patch.meta_description !== undefined) payload.meta_description = patch.meta_description?.trim() || null;
  if (patch.tags !== undefined) payload.tags = normalizeTags(patch.tags);
  if (patch.is_active !== undefined) payload.is_active = patch.is_active;
  if (patch.is_featured !== undefined) payload.is_featured = patch.is_featured;
  if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order;
  if (patch.cover_image_url !== undefined) payload.cover_image_url = patch.cover_image_url;
  if (patch.cover_image_path !== undefined) payload.cover_image_path = patch.cover_image_path;

  if (patch.status !== undefined) {
    const publish = resolvePublishFields({
      ...patch,
      title: patch.title || "",
      content: patch.content || "x",
      status: patch.status,
    });
    payload.status = publish.status;
    payload.published_at = publish.published_at;
    payload.scheduled_at = publish.scheduled_at;
  } else {
    if (patch.published_at !== undefined) payload.published_at = patch.published_at;
    if (patch.scheduled_at !== undefined) payload.scheduled_at = patch.scheduled_at;
  }

  if (patch.slug !== undefined || patch.title !== undefined) {
    const base = slugifyBlogTitle(patch.slug?.trim() || String(patch.title || ""));
    if (base) payload.slug = await ensureUniqueSlug(client, base, id);
  }

  await ensureSiteBlogStorage(client);

  const location = await locateBlogPost(client, id);
  const fallbackPatch = payload as Partial<SiteBlogPost>;

  if (location === "fallback") {
    await updateFallbackBlogPost(client, id, fallbackPatch);
    return;
  }

  if (location === "rds") {
    const { data, error } = await withBlogStorageRetry(client, () =>
      client.from("site_blog_posts").update(payload).eq("id", id).select("id").maybeSingle()
    );
    if (error) throw error;
    if (data?.id) return;
    // Post disappeared from RDS — fall back to cloud JSON if present.
    if (await findFallbackBlogPostById(client, id)) {
      await updateFallbackBlogPost(client, id, fallbackPatch);
      return;
    }
    throw new Error("Blog post not found.");
  }

  if (!(await siteBlogTableAvailable(client))) {
    await updateFallbackBlogPost(client, id, fallbackPatch);
    return;
  }

  const { data, error } = await withBlogStorageRetry(client, () =>
    client.from("site_blog_posts").update(payload).eq("id", id).select("id").maybeSingle()
  );
  if (error) {
    if (isSiteBlogTableMissing(error)) {
      resetSiteBlogStorageCache();
      await updateFallbackBlogPost(client, id, fallbackPatch);
      return;
    }
    throw error;
  }
  if (data?.id) return;

  if (await findFallbackBlogPostById(client, id)) {
    await updateFallbackBlogPost(client, id, fallbackPatch);
    return;
  }

  if (fallbackPatch.title && fallbackPatch.content) {
    await updateFallbackBlogPost(client, id, fallbackPatch);
    return;
  }

  throw new Error("Blog post not found. Save as draft first, then publish.");
}

async function uploadBlogImage(
  client: SupabaseClient,
  postId: string,
  file: File,
  subfolder: "cover" | "content"
): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file (JPG, PNG, WebP, etc.).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 8 MB or smaller.");
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `blog/${postId}/${subfolder}/${Date.now()}-${safeName}`;
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
  const url =
    publicStorageObjectUrl(BLOG_BUCKET, path) || resolveStorageUrl(pub.publicUrl) || pub.publicUrl;
  return { url, path };
}

export async function uploadBlogCoverImage(
  client: SupabaseClient,
  postId: string,
  file: File
): Promise<{ cover_image_url: string; cover_image_path: string }> {
  const { url, path } = await uploadBlogImage(client, postId, file, "cover");
  await updateBlogPost(client, postId, { cover_image_url: url, cover_image_path: path });
  return { cover_image_url: url, cover_image_path: path };
}

/** Upload inline image for markdown body — returns public URL to insert as ![alt](url). */
export async function uploadBlogContentImage(
  client: SupabaseClient,
  postId: string,
  file: File
): Promise<string> {
  const { url } = await uploadBlogImage(client, postId, file, "content");
  return url;
}

export async function deleteBlogPost(client: SupabaseClient, row: SiteBlogPost): Promise<void> {
  if (row.cover_image_path) {
    await client.storage.from(BLOG_BUCKET).remove([row.cover_image_path]);
  }
  await ensureSiteBlogStorage(client);

  const location = await locateBlogPost(client, row.id);
  if (location === "fallback" || location === null) {
    try {
      await deleteFallbackBlogPost(client, row.id);
    } catch {
      /* ignore missing fallback row */
    }
  }
  if (location === "rds" || location === null) {
    if (await siteBlogTableAvailable(client)) {
      const { error } = await withBlogStorageRetry(client, () =>
        client.from("site_blog_posts").delete().eq("id", row.id)
      );
      if (error && !isSiteBlogTableMissing(error)) throw error;
    }
  }
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

export function blogStatusLabel(status: BlogPostStatus): string {
  switch (status) {
    case "published":
      return "Published";
    case "scheduled":
      return "Scheduled";
    default:
      return "Draft";
  }
}
