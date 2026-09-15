import path from "node:path";

/** Sort key so 85 ensure-schema runs after 82 and before 83 admin RPCs. */
export function awsSqlSortKey(filename) {
  const base = path.basename(filename);
  if (base.includes("85-rds-staff-attendance-offices-ensure-schema")) return 829;
  if (base.includes("83-rds-staff-attendance-offices-admin-rpc")) return 831;
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
