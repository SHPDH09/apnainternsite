import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const ENSURE_SQL = "aws/scripts/85-rds-staff-attendance-offices-ensure-schema.sql";
const ADMIN_RPC_SQL = "aws/scripts/83-rds-staff-attendance-offices-admin-rpc.sql";
const OFFICES_SQL = "aws/scripts/82-rds-staff-attendance-offices.sql";

const OFFICE_TABLES = new Set(["staff_attendance_offices", "staff_office_assignments"]);
const OFFICE_RPCS = [
  "admin_upsert_staff_attendance_office",
  "admin_list_staff_attendance_offices",
  "admin_list_staff_office_assignments",
] as const;

let bootstrapped = false;

export function isStaffAttendanceOfficesTable(table: string): boolean {
  return OFFICE_TABLES.has(table);
}

export function isStaffAttendanceOfficesRpc(name: string): boolean {
  return (
    name === "admin_list_staff_attendance_offices" ||
    name === "admin_upsert_staff_attendance_office" ||
    name === "admin_delete_staff_attendance_office" ||
    name === "admin_assign_staff_office" ||
    name === "admin_remove_staff_office_assignment" ||
    name === "admin_list_staff_office_assignments" ||
    name === "_ensure_staff_attendance_office_schema"
  );
}

export function isStaffAttendanceOfficesRpcMissingError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  const code = String((err as { code?: string })?.code || "");
  return (
    code === "42883" ||
    /could not find the function/i.test(msg) ||
    /function public\.admin_upsert_staff_attendance_office does not exist/i.test(msg) ||
    /function public\._ensure_staff_attendance_office_schema does not exist/i.test(msg) ||
    /relation .*staff_attendance_offices.* does not exist/i.test(msg) ||
    /relation .*staff_office_assignments.* does not exist/i.test(msg)
  );
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

async function functionExists(fn: string): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = $1
     ) AS ok`,
    [fn]
  );
  return Boolean(rows[0]?.ok);
}

async function schemaReady(): Promise<boolean> {
  const [offices, assignments] = await Promise.all([
    tableExists("staff_attendance_offices"),
    tableExists("staff_office_assignments"),
  ]);
  return offices && assignments;
}

async function rpcsReady(): Promise<boolean> {
  for (const fn of OFFICE_RPCS) {
    if (!(await functionExists(fn))) return false;
  }
  return true;
}

async function bootstrapReady(): Promise<boolean> {
  return (await schemaReady()) && (await rpcsReady());
}

/** Minimal idempotent DDL — both tables must exist. */
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
}

async function runSqlFile(rel: string): Promise<boolean> {
  const fp = resolveSqlPath(rel);
  if (!fs.existsSync(fp)) {
    console.warn("[staff-attendance-offices-bootstrap] sql file missing:", rel);
    return false;
  }
  await query(fs.readFileSync(fp, "utf8"));
  return true;
}

/** Apply ensure + admin RPC SQL (85 then 83). Required for office save/list. */
async function ensureAdminOfficeRpcs(): Promise<void> {
  await ensureCoreTables();

  let applied = false;
  try {
    if (await runSqlFile(ENSURE_SQL)) applied = true;
  } catch (err) {
    console.warn("[staff-attendance-offices-bootstrap] ensure sql:", String(err).slice(0, 240));
  }

  try {
    if (await runSqlFile(ADMIN_RPC_SQL)) applied = true;
  } catch (err) {
    console.warn("[staff-attendance-offices-bootstrap] admin rpc sql:", String(err).slice(0, 240));
  }

  if (!(await rpcsReady())) {
    // Last resort: run bundled files from repo root even if moduleDir sql/ missed a file
    const root = path.resolve(moduleDir, "../..");
    for (const rel of [ENSURE_SQL, ADMIN_RPC_SQL]) {
      const fp = path.join(root, rel);
      if (!fs.existsSync(fp)) continue;
      try {
        await query(fs.readFileSync(fp, "utf8"));
        applied = true;
      } catch (err) {
        console.warn("[staff-attendance-offices-bootstrap] retry sql:", rel, String(err).slice(0, 180));
      }
    }
  }

  if (!applied && !(await rpcsReady())) {
    throw new Error("Could not apply staff attendance office admin RPC SQL");
  }
}

/** Idempotent RDS bootstrap for staff attendance office tables + admin RPCs. */
export async function ensureStaffAttendanceOfficesSchema(): Promise<{ ok: true }> {
  if (await bootstrapReady()) {
    bootstrapped = true;
    return { ok: true };
  }

  bootstrapped = false;
  await ensureAdminOfficeRpcs();

  try {
    await runSqlFile(OFFICES_SQL);
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err || "");
    if (!/already exists|duplicate key|does not exist|cannot change return type|42P13|42710|42701/i.test(msg)) {
      console.warn("[staff-attendance-offices-bootstrap] offices sql:", msg.slice(0, 240));
    }
  }

  await ensureCoreTables();

  if (!(await bootstrapReady())) {
    throw new Error(
      "staff_attendance_offices bootstrap incomplete — admin_upsert_staff_attendance_office missing on RDS"
    );
  }

  bootstrapped = true;
  return { ok: true };
}
