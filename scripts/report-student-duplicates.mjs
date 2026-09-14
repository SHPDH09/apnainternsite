#!/usr/bin/env node
/**
 * Report duplicate student emails, phones, roll numbers, and registration numbers.
 * Run before applying 77-rds-global-student-uniqueness.sql unique indexes in production.
 *
 * Usage: DATABASE_URL=postgres://... node scripts/report-student-duplicates.mjs
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Set DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: /rds\.amazonaws\.com/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT * FROM public.report_student_field_duplicates()"
    );
    if (!rows.length) {
      console.log("No duplicate groups found — safe to apply unique indexes.");
      return;
    }
    console.log(`Found ${rows.length} duplicate group(s):\n`);
    for (const row of rows) {
      console.log(`- ${row.field_name}: "${row.field_value}" (${row.conflict_count} records)`);
      console.log(`  sample ids: ${(row.sample_student_ids || []).slice(0, 5).join(", ")}`);
    }
    process.exitCode = 2;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/report_student_field_duplicates|does not exist/i.test(msg)) {
      console.error(
        "Migration not applied yet. Run aws/scripts/77-rds-global-student-uniqueness.sql first."
      );
    } else {
      console.error(msg);
    }
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
