import path from "node:path";

/** Sort key so 85 ensure-schema runs after 82 and before 83 admin RPCs. */
export function awsSqlSortKey(filename) {
  const base = path.basename(filename);
  if (base.includes("85-rds-staff-attendance-offices-ensure-schema")) return 829;
  if (base.includes("83-rds-staff-attendance-offices-admin-rpc")) return 831;
  if (base.includes("87-rds-staff-attendance-offices-all-admin-rpc-fix")) return 832;
  const m = base.match(/^(\d+)-/);
  return m ? Number(m[1]) * 10 : 99999;
}

export function compareAwsSqlFilenames(a, b) {
  const oa = awsSqlSortKey(a);
  const ob = awsSqlSortKey(b);
  if (oa !== ob) return oa - ob;
  return path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true });
}

export const STAFF_OFFICE_ADMIN_RPC_FILES = [
  "aws/scripts/85-rds-staff-attendance-offices-ensure-schema.sql",
  "aws/scripts/83-rds-staff-attendance-offices-admin-rpc.sql",
];

/** All staff office admin RPCs that must exist on RDS. */
export const STAFF_OFFICE_REQUIRED_RPCS = [
  "admin_list_staff_attendance_offices",
  "admin_upsert_staff_attendance_office",
  "admin_delete_staff_attendance_office",
  "admin_assign_staff_office",
  "admin_remove_staff_office_assignment",
  "admin_list_staff_office_assignments",
];

export function staffOfficeRpcCheckSql() {
  const checks = STAFF_OFFICE_REQUIRED_RPCS.map(
    (name) => `EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = '${name}'
    ) AS ${name}`
  );
  return `SELECT ${checks.join(", ")}`;
}

export function staffOfficeRpcsReady(row) {
  return STAFF_OFFICE_REQUIRED_RPCS.every((name) => Boolean(row?.[name]));
}
