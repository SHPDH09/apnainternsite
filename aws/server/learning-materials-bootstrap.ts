import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

let bootstrapped = false;

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const LEARNING_MATERIALS_SQL = `
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

CREATE INDEX IF NOT EXISTS idx_learning_materials_type_active
  ON public.learning_materials (material_type, is_active, created_at DESC);

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_materials TO authenticated;
GRANT SELECT ON public.learning_materials TO anon;
`;

function readBundledSql(): string {
  const candidates = [
    path.join(moduleDir, "../scripts/97-rds-learning-materials.sql"),
    path.join(process.cwd(), "sql/97-rds-learning-materials.sql"),
    path.join(process.cwd(), "aws/scripts/97-rds-learning-materials.sql"),
  ];
  for (const fp of candidates) {
    if (fs.existsSync(fp)) {
      return fs.readFileSync(fp, "utf8");
    }
  }
  return LEARNING_MATERIALS_SQL;
}

async function tableExists(): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    `SELECT to_regclass('public.learning_materials') IS NOT NULL AS exists`
  );
  return Boolean(rows[0]?.exists);
}

export function isLearningMaterialsTable(table: string): boolean {
  return table === "learning_materials";
}

/** Idempotent RDS bootstrap for learning_materials (student dashboard + admin uploads). */
export async function ensureLearningMaterialsSchema(): Promise<{ ok: true; applied: boolean }> {
  if (bootstrapped && (await tableExists())) {
    return { ok: true, applied: false };
  }

  const sql = readBundledSql();
  await query(sql);

  bootstrapped = true;
  return { ok: true, applied: true };
}
