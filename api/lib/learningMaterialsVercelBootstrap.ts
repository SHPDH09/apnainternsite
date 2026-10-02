/**
 * Vercel-safe RDS bootstrap for learning_materials (no aws/server imports).
 */
import type { QueryResultRow } from "pg";

let pool: import("pg").Pool | null = null;
let bootstrapped = false;

function pgPoolConfig(databaseUrl: string) {
  return {
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 20000,
  };
}

async function getPool(): Promise<import("pg").Pool> {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured on this deployment");
  }
  const pg = await import("pg");
  pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  return pool;
}

async function tableExists(client: import("pg").Pool): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT to_regclass('public.learning_materials') IS NOT NULL AS exists`
  );
  return Boolean(rows[0]?.exists);
}

async function applyLearningMaterialsCore(client: import("pg").Pool): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.learning_materials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      material_type text NOT NULL DEFAULT 'learning_material'
        CHECK (material_type IN ('learning_material', 'project_report')),
      file_path text,
      file_url text,
      file_name text,
      mime_type text,
      target_universities text[] DEFAULT '{}',
      target_colleges text[] DEFAULT '{}',
      target_domains text[] DEFAULT '{}',
      target_modes text[] DEFAULT '{}',
      is_active boolean NOT NULL DEFAULT true,
      created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_learning_materials_type_active
      ON public.learning_materials (material_type, is_active, created_at DESC);
  `);

  try {
    await client.query(`
      ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Admins manage learning materials" ON public.learning_materials;
      CREATE POLICY "Admins manage learning materials"
        ON public.learning_materials
        FOR ALL
        TO authenticated
        USING (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
          OR public.has_role(auth.uid(), 'staff'::public.app_role)
        )
        WITH CHECK (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
          OR public.has_role(auth.uid(), 'staff'::public.app_role)
        );
      DROP POLICY IF EXISTS "Students read active learning materials" ON public.learning_materials;
      CREATE POLICY "Students read active learning materials"
        ON public.learning_materials
        FOR SELECT
        TO authenticated, anon
        USING (is_active = true);
    `);
  } catch {
    await client.query(`ALTER TABLE public.learning_materials DISABLE ROW LEVEL SECURITY`);
  }

  await client.query(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_materials TO authenticated;
    GRANT SELECT ON public.learning_materials TO anon;
  `);
}

export async function ensureLearningMaterialsSchema(): Promise<{ ok: true; applied: boolean }> {
  const client = await getPool();
  if (bootstrapped && (await tableExists(client))) {
    return { ok: true, applied: false };
  }
  if (await tableExists(client)) {
    bootstrapped = true;
    return { ok: true, applied: false };
  }
  await applyLearningMaterialsCore(client);
  bootstrapped = true;
  return { ok: true, applied: true };
}

export async function learningMaterialsQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  await ensureLearningMaterialsSchema();
  const client = await getPool();
  return client.query<T>(text, params);
}
