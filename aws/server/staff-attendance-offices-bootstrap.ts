import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const OFFICES_SQL = "aws/scripts/82-rds-staff-attendance-offices.sql";
const ADMIN_RPC_SQL = "aws/scripts/83-rds-staff-attendance-offices-admin-rpc.sql";

const OFFICE_TABLES = new Set(["staff_attendance_offices", "staff_office_assignments"]);

let bootstrapped = false;

export function isStaffAttendanceOfficesTable(table: string): boolean {
  return OFFICE_TABLES.has(table);
}

function resolveSqlPath(rel: string): string {
  const bundled = path.join(moduleDir, "sql", path.basename(rel));
  if (fs.existsSync(bundled)) return bundled;
  return path.resolve(moduleDir, "../..", rel);
}

async function tableExists(table: string): Promise<boolean> {
  const { rows } = await query<{ reg: string | null }>(
    `SELECT to_regclass($1)::text AS reg`,
    [`public.${table}`]
  );
  return Boolean(rows[0]?.reg);
}

async function schemaReady(): Promise<boolean> {
  const [offices, assignments] = await Promise.all([
    tableExists("staff_attendance_offices"),
    tableExists("staff_office_assignments"),
  ]);
  return offices && assignments;
}

/** Minimal idempotent DDL — both tables must exist (offices alone is not enough). */
async function ensureCoreTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS public.staff_attendance_offices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      address text,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      radius_meters integer NOT NULL DEFAULT 200 CHECK (radius_meters BETWEEN 25 AND 5000),
      max_gps_accuracy_m numeric DEFAULT 100 CHECK (max_gps_accuracy_m IS NULL OR max_gps_accuracy_m > 0),
      require_face boolean NOT NULL DEFAULT true,
      require_geo boolean NOT NULL DEFAULT true,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.staff_office_assignments (
      employee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      office_id uuid NOT NULL REFERENCES public.staff_attendance_offices(id) ON DELETE RESTRICT,
      assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      assigned_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_staff_office_assignments_office
      ON public.staff_office_assignments (office_id);
  `);

  try {
    await query(`
      ALTER TABLE public.staff_attendance_offices ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.staff_office_assignments ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Admins manage staff_attendance_offices" ON public.staff_attendance_offices;
      CREATE POLICY "Admins manage staff_attendance_offices" ON public.staff_attendance_offices
      FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      );

      DROP POLICY IF EXISTS "Staff read assigned office" ON public.staff_attendance_offices;
      CREATE POLICY "Staff read assigned office" ON public.staff_attendance_offices
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.staff_office_assignments a
          WHERE a.employee_id = auth.uid() AND a.office_id = staff_attendance_offices.id
        )
      );

      DROP POLICY IF EXISTS "Admins manage staff_office_assignments" ON public.staff_office_assignments;
      CREATE POLICY "Admins manage staff_office_assignments" ON public.staff_office_assignments
      FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      );

      DROP POLICY IF EXISTS "Staff read own office assignment" ON public.staff_office_assignments;
      CREATE POLICY "Staff read own office assignment" ON public.staff_office_assignments
      FOR SELECT TO authenticated
      USING (employee_id = auth.uid());
    `);
  } catch {
    await query(`
      ALTER TABLE public.staff_attendance_offices DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.staff_office_assignments DISABLE ROW LEVEL SECURITY;
    `);
  }

  await query(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_attendance_offices TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_office_assignments TO authenticated;
  `);

  try {
    await query(`
      ALTER TABLE public.employee_attendance
        ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.staff_attendance_offices(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS check_in_distance_m numeric,
        ADD COLUMN IF NOT EXISTS check_out_distance_m numeric,
        ADD COLUMN IF NOT EXISTS check_in_gps_accuracy_m numeric,
        ADD COLUMN IF NOT EXISTS check_out_gps_accuracy_m numeric,
        ADD COLUMN IF NOT EXISTS verification_flags jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
  } catch {
    /* employee_attendance may not exist in some envs */
  }
}

async function runSqlFile(rel: string): Promise<void> {
  const fp = resolveSqlPath(rel);
  if (!fs.existsSync(fp)) return;
  await query(fs.readFileSync(fp, "utf8"));
}

/** Idempotent RDS bootstrap for staff attendance office tables + admin RPCs. */
export async function ensureStaffAttendanceOfficesSchema(): Promise<{ ok: true }> {
  if (bootstrapped && (await schemaReady())) return { ok: true };

  // Always ensure both core tables — offices may exist from RPC without assignments.
  await ensureCoreTables();

  try {
    await runSqlFile(OFFICES_SQL);
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err || "");
    if (!/already exists|duplicate key|does not exist|cannot change return type|42P13|42710|42701/i.test(msg)) {
      console.warn("[staff-attendance-offices-bootstrap] offices sql:", msg.slice(0, 240));
    }
  }

  // Re-run core DDL in case full script failed mid-way.
  await ensureCoreTables();

  try {
    await runSqlFile(ADMIN_RPC_SQL);
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err || "");
    console.warn("[staff-attendance-offices-bootstrap] admin rpc sql:", msg.slice(0, 240));
  }

  if (!(await schemaReady())) {
    throw new Error("staff_attendance_offices / staff_office_assignments could not be created");
  }

  bootstrapped = true;
  return { ok: true };
}
