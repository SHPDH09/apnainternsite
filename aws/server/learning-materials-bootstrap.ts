import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

let bootstrapped = false;

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function learningMaterialsSqlPath(): string {
  return path.join(moduleDir, "../scripts/97-rds-learning-materials.sql");
}

async function tableExists(): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    `SELECT to_regclass('public.learning_materials') IS NOT NULL AS exists`
  );
  return Boolean(rows[0]?.exists);
}

/** Idempotent RDS bootstrap for learning_materials (student dashboard + admin uploads). */
export async function ensureLearningMaterialsSchema(): Promise<{ ok: true; applied: boolean }> {
  if (bootstrapped && (await tableExists())) {
    return { ok: true, applied: false };
  }

  const fp = learningMaterialsSqlPath();
  if (!fs.existsSync(fp)) {
    throw new Error("97-rds-learning-materials.sql bundle not found in deployment.");
  }
  await query(fs.readFileSync(fp, "utf8"));

  bootstrapped = true;
  return { ok: true, applied: true };
}
