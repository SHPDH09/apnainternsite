import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

let bootstrapped = false;

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SQL_BASENAME = "97-rds-learning-materials.sql";

function resolveSqlPath(): string {
  const bundled = path.join(moduleDir, "sql", SQL_BASENAME);
  if (fs.existsSync(bundled)) return bundled;
  const scripts = path.join(moduleDir, "../scripts", SQL_BASENAME);
  if (fs.existsSync(scripts)) return scripts;
  return path.resolve(moduleDir, "../..", "aws/scripts", SQL_BASENAME);
}

async function tableExists(): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    `SELECT to_regclass('public.learning_materials') IS NOT NULL AS exists`
  );
  return Boolean(rows[0]?.exists);
}

async function applyLearningMaterialsCore(): Promise<void> {
  await query(`
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

  await query(`
    CREATE INDEX IF NOT EXISTS idx_learning_materials_type_active
      ON public.learning_materials (material_type, is_active, created_at DESC);
  `);

  try {
    await query(`
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
    await query(`ALTER TABLE public.learning_materials DISABLE ROW LEVEL SECURITY`);
  }

  await query(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_materials TO authenticated;
    GRANT SELECT ON public.learning_materials TO anon;
  `);
}

/** Idempotent RDS bootstrap for learning_materials (student dashboard + admin uploads). */
export async function ensureLearningMaterialsSchema(): Promise<{ ok: true; applied: boolean }> {
  if (bootstrapped && (await tableExists())) {
    return { ok: true, applied: false };
  }

  if (await tableExists()) {
    bootstrapped = true;
    return { ok: true, applied: false };
  }

  const fp = resolveSqlPath();
  if (fs.existsSync(fp)) {
    try {
      await query(fs.readFileSync(fp, "utf8"));
    } catch {
      await applyLearningMaterialsCore();
    }
  } else {
    await applyLearningMaterialsCore();
  }

  bootstrapped = true;
  console.log("[learning-materials-bootstrap] learning_materials ready");
  return { ok: true, applied: true };
}
