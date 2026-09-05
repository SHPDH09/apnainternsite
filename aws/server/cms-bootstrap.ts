import { query } from "./db.js";

const BOOTSTRAPPED = new Set<string>();

const CMS_TABLES = ["site_popups", "site_contact_details", "site_whatsapp_links", "site_blog_posts"] as const;
const CMS_TABLE_SET = new Set<string>(CMS_TABLES);

export function isCmsTable(table: string): boolean {
  return CMS_TABLE_SET.has(table);
}

export function isMissingRelationError(err: unknown, table?: string): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  if (!/does not exist|relation .* does not exist|undefined_table/i.test(msg)) return false;
  if (table && !new RegExp(`\\b${table}\\b`, "i").test(msg)) return false;
  return true;
}

async function runSql(sql: string): Promise<void> {
  await query(sql);
}

async function bootstrapSitePopups(): Promise<void> {
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.site_popups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL DEFAULT '',
      popup_type text NOT NULL DEFAULT 'text' CHECK (popup_type IN ('text', 'image')),
      message text,
      image_url text,
      image_path text,
      cta_label text,
      cta_url text,
      pages jsonb NOT NULL DEFAULT '["all"]'::jsonb,
      start_at timestamptz,
      end_at timestamptz,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_site_popups_active_sort
      ON public.site_popups (is_active, sort_order ASC, created_at DESC);
  `);

  try {
    await runSql(`
      ALTER TABLE public.site_popups ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public read active site_popups" ON public.site_popups;
      CREATE POLICY "Public read active site_popups"
        ON public.site_popups FOR SELECT TO anon, authenticated
        USING (is_active = true);
      DROP POLICY IF EXISTS "Admins manage site_popups" ON public.site_popups;
      CREATE POLICY "Admins manage site_popups"
        ON public.site_popups FOR ALL TO authenticated
        USING (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
        WITH CHECK (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        );
    `);
  } catch {
    await runSql(`ALTER TABLE public.site_popups DISABLE ROW LEVEL SECURITY`);
  }

  await runSql(`
    GRANT SELECT ON public.site_popups TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_popups TO authenticated;
  `);
}

async function bootstrapSiteContacts(): Promise<void> {
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.site_contact_details (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_type text NOT NULL CHECK (contact_type IN ('phone', 'email', 'address', 'social', 'other')),
      label text NOT NULL DEFAULT '',
      value text NOT NULL DEFAULT '',
      href text,
      icon text,
      display_contexts jsonb NOT NULL DEFAULT '["footer"]'::jsonb,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_site_contact_details_active_sort
      ON public.site_contact_details (is_active, sort_order ASC, created_at DESC);
  `);

  try {
    await runSql(`
      ALTER TABLE public.site_contact_details ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public read active site_contact_details" ON public.site_contact_details;
      CREATE POLICY "Public read active site_contact_details"
        ON public.site_contact_details FOR SELECT TO anon, authenticated
        USING (is_active = true);
      DROP POLICY IF EXISTS "Admins manage site_contact_details" ON public.site_contact_details;
      CREATE POLICY "Admins manage site_contact_details"
        ON public.site_contact_details FOR ALL TO authenticated
        USING (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
        WITH CHECK (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        );
    `);
  } catch {
    await runSql(`ALTER TABLE public.site_contact_details DISABLE ROW LEVEL SECURITY`);
  }

  await runSql(`
    GRANT SELECT ON public.site_contact_details TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_contact_details TO authenticated;
  `);
}

async function bootstrapSiteWhatsApp(): Promise<void> {
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.site_whatsapp_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL DEFAULT '',
      link_type text NOT NULL DEFAULT 'channel' CHECK (link_type IN ('group', 'channel', 'number')),
      url text NOT NULL DEFAULT '',
      description text,
      display_contexts jsonb NOT NULL DEFAULT '[]'::jsonb,
      is_active boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_site_whatsapp_links_active_sort
      ON public.site_whatsapp_links (is_active, sort_order ASC, created_at DESC);
  `);

  try {
    await runSql(`
      ALTER TABLE public.site_whatsapp_links ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public read active site_whatsapp_links" ON public.site_whatsapp_links;
      CREATE POLICY "Public read active site_whatsapp_links"
        ON public.site_whatsapp_links FOR SELECT TO anon, authenticated
        USING (is_active = true);
      DROP POLICY IF EXISTS "Admins manage site_whatsapp_links" ON public.site_whatsapp_links;
      CREATE POLICY "Admins manage site_whatsapp_links"
        ON public.site_whatsapp_links FOR ALL TO authenticated
        USING (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
        WITH CHECK (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        );
    `);
  } catch {
    await runSql(`ALTER TABLE public.site_whatsapp_links DISABLE ROW LEVEL SECURITY`);
  }

  await runSql(`
    GRANT SELECT ON public.site_whatsapp_links TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_whatsapp_links TO authenticated;
  `);
}

async function bootstrapSiteBlogPosts(): Promise<void> {
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.site_blog_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL DEFAULT '',
      slug text NOT NULL UNIQUE,
      excerpt text,
      content text NOT NULL DEFAULT '',
      cover_image_url text,
      cover_image_path text,
      author_name text,
      post_type text NOT NULL DEFAULT 'blog' CHECK (post_type IN ('blog', 'vlog')),
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
      published_at timestamptz,
      scheduled_at timestamptz,
      meta_title text,
      meta_description text,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      is_active boolean NOT NULL DEFAULT true,
      is_featured boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_site_blog_posts_public
      ON public.site_blog_posts (is_active, status, is_featured DESC, sort_order ASC, published_at DESC NULLS LAST, scheduled_at DESC NULLS LAST);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_site_blog_posts_slug ON public.site_blog_posts (lower(slug));
  `);

  try {
    await runSql(`
      ALTER TABLE public.site_blog_posts ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public read active blog posts" ON public.site_blog_posts;
      CREATE POLICY "Public read active blog posts"
        ON public.site_blog_posts FOR SELECT TO anon, authenticated USING (is_active = true);
      DROP POLICY IF EXISTS "Admins manage blog posts" ON public.site_blog_posts;
      CREATE POLICY "Admins manage blog posts"
        ON public.site_blog_posts FOR ALL TO authenticated
        USING (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        )
        WITH CHECK (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
        );
    `);
  } catch {
    await runSql(`ALTER TABLE public.site_blog_posts DISABLE ROW LEVEL SECURITY`);
  }

  await runSql(`
    GRANT SELECT ON public.site_blog_posts TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_blog_posts TO authenticated;
  `);
}

export async function ensureCmsTable(table: string): Promise<void> {
  if (!isCmsTable(table) || BOOTSTRAPPED.has(table)) return;
  if (table === "site_popups") await bootstrapSitePopups();
  else if (table === "site_contact_details") await bootstrapSiteContacts();
  else if (table === "site_whatsapp_links") await bootstrapSiteWhatsApp();
  else if (table === "site_blog_posts") await bootstrapSiteBlogPosts();
  BOOTSTRAPPED.add(table);
}

/** Ensure all site CMS tables exist (popups, contacts, WhatsApp links, blog). */
export async function ensureAllCmsTables(): Promise<{ ok: true; tables: string[] }> {
  for (const table of CMS_TABLES) {
    await ensureCmsTable(table);
  }
  return { ok: true, tables: [...CMS_TABLES] };
}
