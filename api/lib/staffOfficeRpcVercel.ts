/** Vercel-safe staff office RDS bootstrap + RPC (loaded dynamically from staff-office-rpc). */
const STAFF_ATTENDANCE_RPCS: Record<string, string[]> = {
  admin_list_staff_attendance_offices: ["p_active_only"],
  admin_upsert_staff_attendance_office: [
    "p_id",
    "p_name",
    "p_address",
    "p_latitude",
    "p_longitude",
    "p_radius_meters",
    "p_max_gps_accuracy_m",
    "p_require_face",
    "p_require_geo",
    "p_is_active",
  ],
  admin_delete_staff_attendance_office: ["p_id"],
  admin_assign_staff_office: ["p_employee_id", "p_office_id"],
  admin_remove_staff_office_assignment: ["p_employee_id"],
  admin_list_staff_office_assignments: [],
  staff_self_attendance_status: [],
  staff_self_check_in: ["p_latitude", "p_longitude", "p_face_score", "p_gps_accuracy_m"],
  staff_self_check_out: ["p_latitude", "p_longitude", "p_face_score", "p_gps_accuracy_m"],
};

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

async function applyStaffOfficeSql(databaseUrl: string): Promise<void> {
  const pg = await import("pg");
  const { applyStaffOfficeBootstrap } = await import("../staffOfficeApply.js");
  const pool = new pg.default.Pool(pgPoolConfig(databaseUrl));
  try {
    await applyStaffOfficeBootstrap(pool);
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

export async function handleStaffOfficeRpcAction(input: {
  databaseUrl: string;
  userId: string;
  name: string;
  args?: Record<string, unknown>;
}): Promise<unknown> {
  const name = String(input.name || "").trim();
  const argOrder = STAFF_ATTENDANCE_RPCS[name];
  if (!argOrder) throw new Error(`Unknown staff attendance RPC: ${name}`);
  await applyStaffOfficeSql(input.databaseUrl);
  return callStaffOfficeRpc(
    input.databaseUrl,
    name,
    argOrder,
    input.args || {},
    input.userId
  );
}

export async function handleEnsureStaffAttendanceOffices(databaseUrl: string): Promise<void> {
  await applyStaffOfficeSql(databaseUrl);
}
