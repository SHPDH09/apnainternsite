/**
 * POST /api/staff-office-rpc — staff office admin RPCs on RDS.
 * Fully self-contained for Vercel (no jwt, no api/lib, no aws/* imports).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SQL_CHUNKS = ["-- Hotfix: ensure-schema + all staff office admin RPCs (85 + 83). Idempotent.\n-- Idempotent schema ensure — called by admin RPCs so tables exist before any read/write.\n\nCREATE OR REPLACE FUNCTION public._ensure_staff_attendance_office_schema()\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  IF to_regclass('public.staff_attendance_offices') IS NULL THEN\n    CREATE TABLE public.staff_attendance_offices (\n      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n      name text NOT NULL,\n      address text,\n      latitude double precision NOT NULL,\n      longitude double precision NOT NULL,\n      radius_meters integer NOT NULL DEFAULT 200 CHECK (radius_meters BETWEEN 25 AND 5000),\n      max_gps_accuracy_m numeric DEFAULT 100 CHECK (max_gps_accuracy_m IS NULL OR max_gps_accuracy_m > 0),\n      require_face boolean NOT NULL DEFAULT true,\n      require_geo boolean NOT NULL DEFAULT true,\n      is_active boolean NOT NULL DEFAULT true,\n      created_at timestamptz NOT NULL DEFAULT now(),\n      updated_at timestamptz NOT NULL DEFAULT now()\n    );\n  END IF;\n\n  IF to_regclass('public.staff_office_assignments') IS NULL THEN\n    CREATE TABLE public.staff_office_assignments (\n      employee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,\n      office_id uuid NOT NULL REFERENCES public.staff_attendance_offices(id) ON DELETE RESTRICT,\n      assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,\n      assigned_at timestamptz NOT NULL DEFAULT now()\n    );\n    CREATE INDEX IF NOT EXISTS idx_staff_office_assignments_office\n      ON public.staff_office_assignments (office_id);\n  END IF;\n\n  ALTER TABLE public.staff_attendance_offices ENABLE ROW LEVEL SECURITY;\n  ALTER TABLE public.staff_office_assignments ENABLE ROW LEVEL SECURITY;\n\n  D","ROP POLICY IF EXISTS \"Admins manage staff_attendance_offices\" ON public.staff_attendance_offices;\n  CREATE POLICY \"Admins manage staff_attendance_offices\" ON public.staff_attendance_offices\n  FOR ALL TO authenticated\n  USING (\n    public.has_role(auth.uid(), 'admin'::public.app_role)\n    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)\n  )\n  WITH CHECK (\n    public.has_role(auth.uid(), 'admin'::public.app_role)\n    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)\n  );\n\n  DROP POLICY IF EXISTS \"Staff read assigned office\" ON public.staff_attendance_offices;\n  CREATE POLICY \"Staff read assigned office\" ON public.staff_attendance_offices\n  FOR SELECT TO authenticated\n  USING (\n    EXISTS (\n      SELECT 1 FROM public.staff_office_assignments a\n      WHERE a.employee_id = auth.uid() AND a.office_id = staff_attendance_offices.id\n    )\n  );\n\n  DROP POLICY IF EXISTS \"Admins manage staff_office_assignments\" ON public.staff_office_assignments;\n  CREATE POLICY \"Admins manage staff_office_assignments\" ON public.staff_office_assignments\n  FOR ALL TO authenticated\n  USING (\n    public.has_role(auth.uid(), 'admin'::public.app_role)\n    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)\n  )\n  WITH CHECK (\n    public.has_role(auth.uid(), 'admin'::public.app_role)\n    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)\n  );\n\n  DROP POLICY IF EXISTS \"Staff read own office assignment\" ON public.staff_office_assignments;\n  CREATE POLICY \"Staff read own office assignment\" ON public.staff_office_assignments\n  FOR SELECT TO authenticated\n  USING (employee_id = auth.uid());\n\n  GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_attendance_offices TO authenticated;\n  GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_office_assignments TO aut","henticated;\n\n  IF to_regclass('public.employee_attendance') IS NOT NULL THEN\n    ALTER TABLE public.employee_attendance\n      ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.staff_attendance_offices(id) ON DELETE SET NULL,\n      ADD COLUMN IF NOT EXISTS check_in_distance_m numeric,\n      ADD COLUMN IF NOT EXISTS check_out_distance_m numeric,\n      ADD COLUMN IF NOT EXISTS check_in_gps_accuracy_m numeric,\n      ADD COLUMN IF NOT EXISTS check_out_gps_accuracy_m numeric,\n      ADD COLUMN IF NOT EXISTS verification_flags jsonb NOT NULL DEFAULT '{}'::jsonb;\n  END IF;\nEND;\n$$;\n\nGRANT EXECUTE ON FUNCTION public._ensure_staff_attendance_office_schema() TO authenticated;\n\n-- Admin RPCs for office CRUD (SECURITY DEFINER — auto-creates schema via _ensure_staff_attendance_office_schema).\n-- Run aws/scripts/85-rds-staff-attendance-offices-ensure-schema.sql before this file when applying manually.\n\nCREATE OR REPLACE FUNCTION public._assert_admin_attendance_offices()\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  IF auth.uid() IS NULL THEN\n    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';\n  END IF;\n  IF NOT (\n    public.has_role(auth.uid(), 'admin'::public.app_role)\n    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)\n  ) THEN\n    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';\n  END IF;\nEND;\n$$;\n\nCREATE OR REPLACE FUNCTION public.admin_list_staff_attendance_offices(p_active_only boolean DEFAULT false)\nRETURNS jsonb\nLANGUAGE plpgsql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  PERFORM public._ensure_staff_attendance_office_schema();\n  PERFORM public._assert_admin_attendance_offices();\n  RETURN coalesce(\n    (SELECT jsonb_agg(to_jsonb(o) ORDER BY o.name)\n     FROM public.sta","ff_attendance_offices o\n     WHERE NOT coalesce(p_active_only, false) OR o.is_active IS TRUE),\n    '[]'::jsonb\n  );\nEND;\n$$;\n\nCREATE OR REPLACE FUNCTION public.admin_upsert_staff_attendance_office(\n  p_id uuid DEFAULT NULL,\n  p_name text DEFAULT NULL,\n  p_address text DEFAULT NULL,\n  p_latitude double precision DEFAULT NULL,\n  p_longitude double precision DEFAULT NULL,\n  p_radius_meters integer DEFAULT 200,\n  p_max_gps_accuracy_m numeric DEFAULT 100,\n  p_require_face boolean DEFAULT true,\n  p_require_geo boolean DEFAULT true,\n  p_is_active boolean DEFAULT true\n)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nDECLARE\n  v_row public.staff_attendance_offices%ROWTYPE;\nBEGIN\n  PERFORM public._ensure_staff_attendance_office_schema();\n  PERFORM public._assert_admin_attendance_offices();\n\n  IF p_name IS NULL OR trim(p_name) = '' THEN\n    RAISE EXCEPTION 'Office name is required';\n  END IF;\n  IF p_latitude IS NULL OR p_longitude IS NULL THEN\n    RAISE EXCEPTION 'Latitude and longitude are required';\n  END IF;\n\n  IF p_id IS NULL THEN\n    INSERT INTO public.staff_attendance_offices (\n      name, address, latitude, longitude, radius_meters,\n      max_gps_accuracy_m, require_face, require_geo, is_active, updated_at\n    )\n    VALUES (\n      trim(p_name),\n      nullif(trim(coalesce(p_address, '')), ''),\n      p_latitude,\n      p_longitude,\n      coalesce(p_radius_meters, 200),\n      p_max_gps_accuracy_m,\n      coalesce(p_require_face, true),\n      coalesce(p_require_geo, true),\n      coalesce(p_is_active, true),\n      now()\n    )\n    RETURNING * INTO v_row;\n  ELSE\n    UPDATE public.staff_attendance_offices\n    SET\n      name = trim(p_name),\n      address = nullif(trim(coalesce(p_address, '')), ''),\n      latitude = p_latitude,\n      longitude = p_longit","ude,\n      radius_meters = coalesce(p_radius_meters, 200),\n      max_gps_accuracy_m = p_max_gps_accuracy_m,\n      require_face = coalesce(p_require_face, true),\n      require_geo = coalesce(p_require_geo, true),\n      is_active = coalesce(p_is_active, true),\n      updated_at = now()\n    WHERE id = p_id\n    RETURNING * INTO v_row;\n\n    IF NOT FOUND THEN\n      RAISE EXCEPTION 'Office not found';\n    END IF;\n  END IF;\n\n  RETURN to_jsonb(v_row);\nEND;\n$$;\n\nCREATE OR REPLACE FUNCTION public.admin_delete_staff_attendance_office(p_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  PERFORM public._ensure_staff_attendance_office_schema();\n  PERFORM public._assert_admin_attendance_offices();\n\n  IF p_id IS NULL THEN\n    RAISE EXCEPTION 'Office id is required';\n  END IF;\n\n  DELETE FROM public.staff_attendance_offices WHERE id = p_id;\n\n  IF NOT FOUND THEN\n    RAISE EXCEPTION 'Office not found or still assigned to employees';\n  END IF;\n\n  RETURN jsonb_build_object('ok', true, 'id', p_id);\nEND;\n$$;\n\nCREATE OR REPLACE FUNCTION public.admin_assign_staff_office(\n  p_employee_id uuid,\n  p_office_id uuid\n)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nDECLARE\n  v_row public.staff_office_assignments%ROWTYPE;\nBEGIN\n  PERFORM public._ensure_staff_attendance_office_schema();\n  PERFORM public._assert_admin_attendance_offices();\n\n  IF p_employee_id IS NULL OR p_office_id IS NULL THEN\n    RAISE EXCEPTION 'Employee and office are required';\n  END IF;\n\n  IF NOT EXISTS (\n    SELECT 1 FROM public.staff_attendance_offices o\n    WHERE o.id = p_office_id AND o.is_active IS TRUE\n  ) THEN\n    RAISE EXCEPTION 'Office not found or inactive';\n  END IF;\n\n  INSERT INTO public.staff_office_assignments (employee_id, office_id, assigned_","by, assigned_at)\n  VALUES (p_employee_id, p_office_id, auth.uid(), now())\n  ON CONFLICT (employee_id) DO UPDATE\n  SET office_id = EXCLUDED.office_id,\n      assigned_by = auth.uid(),\n      assigned_at = now()\n  RETURNING * INTO v_row;\n\n  RETURN to_jsonb(v_row);\nEND;\n$$;\n\nCREATE OR REPLACE FUNCTION public.admin_remove_staff_office_assignment(p_employee_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  PERFORM public._ensure_staff_attendance_office_schema();\n  PERFORM public._assert_admin_attendance_offices();\n\n  IF p_employee_id IS NULL THEN\n    RAISE EXCEPTION 'Employee id is required';\n  END IF;\n\n  DELETE FROM public.staff_office_assignments WHERE employee_id = p_employee_id;\n\n  RETURN jsonb_build_object('ok', true, 'employee_id', p_employee_id);\nEND;\n$$;\n\nCREATE OR REPLACE FUNCTION public.admin_list_staff_office_assignments()\nRETURNS jsonb\nLANGUAGE plpgsql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  PERFORM public._ensure_staff_attendance_office_schema();\n  PERFORM public._assert_admin_attendance_offices();\n  RETURN coalesce(\n    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.assigned_at DESC)\n     FROM public.staff_office_assignments a),\n    '[]'::jsonb\n  );\nEND;\n$$;\n\nGRANT EXECUTE ON FUNCTION public.admin_list_staff_attendance_offices(boolean) TO authenticated;\nGRANT EXECUTE ON FUNCTION public.admin_upsert_staff_attendance_office(\n  uuid, text, text, double precision, double precision, integer, numeric, boolean, boolean, boolean\n) TO authenticated;\nGRANT EXECUTE ON FUNCTION public.admin_delete_staff_attendance_office(uuid) TO authenticated;\nGRANT EXECUTE ON FUNCTION public.admin_assign_staff_office(uuid, uuid) TO authenticated;\nGRANT EXECUTE ON FUNCTION public.admin_remove_staff_office_assignment(uuid) TO aut","henticated;\nGRANT EXECUTE ON FUNCTION public.admin_list_staff_office_assignments() TO authenticated;\n"];
function bootstrapSql() { return SQL_CHUNKS.join(""); }


const STAFF_OFFICE_RPCS: Record<string, string[]> = {
  admin_list_staff_attendance_offices: ["p_active_only"],
  admin_upsert_staff_attendance_office: [
    "p_id", "p_name", "p_address", "p_latitude", "p_longitude",
    "p_radius_meters", "p_max_gps_accuracy_m", "p_require_face", "p_require_geo", "p_is_active",
  ],
  admin_delete_staff_attendance_office: ["p_id"],
  admin_assign_staff_office: ["p_employee_id", "p_office_id"],
  admin_remove_staff_office_assignment: ["p_employee_id"],
  admin_list_staff_office_assignments: [],
};

const REQUIRED_RPCS = Object.keys(STAFF_OFFICE_RPCS);
const LAMBDA_AUTH =
  process.env.LAMBDA_API_URL?.trim()?.replace(/\/$/, "") ||
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging";

function pgPoolConfig(databaseUrl: string) {
  return {
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, ""),
    ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 15000,
  };
}

function bearer(req: VercelRequest): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(h) ? h[0] : h;
  const m = raw ? String(raw).match(/^Bearer\s+(.+)$/i) : null;
  return m?.[1]?.trim() || null;
}

async function verifySession(token: string): Promise<{ sub: string } | null> {
  try {
    const res = await fetch(`${LAMBDA_AUTH}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json().catch(() => null)) as { id?: string; sub?: string } | null;
    const sub = user?.id || user?.sub;
    return sub ? { sub: String(sub) } : null;
  } catch {
    return null;
  }
}

async function applyStaffOfficeSql(databaseUrl: string): Promise<void> {
  const pg = await import("pg");
  const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  try {
    await pool.query(bootstrapSql());
    const checks = REQUIRED_RPCS.map(
      (name) => `EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = '${name}'
      ) AS "${name}"`
    );
    const { rows } = await pool.query<Record<string, boolean>>(`SELECT ${checks.join(", ")}`);
    const missing = REQUIRED_RPCS.filter((n) => !rows[0]?.[n]);
    if (missing.length) throw new Error(`Staff office RPCs still missing: ${missing.join(", ")}`);
  } finally {
    await pool.end();
  }
}

async function callStaffOfficeRpc(
  databaseUrl: string,
  fnName: string,
  argOrder: string[],
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const pg = await import("pg");
  const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
    const values = argOrder.map((k) => (k in args ? args[k] : null));
    const rpcSql =
      argOrder.length === 0
        ? `SELECT public.${fnName}() AS result`
        : `SELECT public.${fnName}(${argOrder.map((_, i) => `$${i + 1}`).join(", ")}) AS result`;
    const { rows } = await client.query<{ result: unknown }>(rpcSql, values);
    await client.query("COMMIT");
    return rows[0]?.result ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ data: null, error: { message: "Method not allowed" } });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return res.status(503).json({
      data: null,
      error: { message: "DATABASE_URL is not configured on this deployment" },
    });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ data: null, error: { message: "Authorization Bearer token required" } });
  }
  const session = await verifySession(token);
  if (!session) {
    return res.status(401).json({ data: null, error: { message: "Invalid or expired session" } });
  }

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
    name?: string;
    args?: Record<string, unknown>;
  };
  const name = String(body.name || "").trim();
  const args = body.args && typeof body.args === "object" ? body.args : {};
  const argOrder = STAFF_OFFICE_RPCS[name];
  if (!argOrder) {
    return res.status(400).json({ data: null, error: { message: `Unknown staff office RPC: ${name}` } });
  }

  try {
    await applyStaffOfficeSql(databaseUrl);
    const data = await callStaffOfficeRpc(databaseUrl, name, argOrder, args, session.sub);
    return res.status(200).json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[staff-office-rpc]", name, message);
    return res.status(400).json({ data: null, error: { message } });
  }
}
