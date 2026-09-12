#!/usr/bin/env node
/**
 * Upsert LMS courses from aws/scripts/67 and 68 via production REST API.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REST_BASE =
  process.env.REST_BASE?.trim() ||
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging/rest/v1";
const REST_KEY = process.env.RDS_ANON_KEY?.trim() || "local-anon-key";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function rest(method, table, { query = "", body, prefer = "return=representation" } = {}) {
  const res = await fetch(`${REST_BASE}/${table}${query}`, {
    method,
    headers: {
      apikey: REST_KEY,
      Authorization: `Bearer ${REST_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok && res.status !== 409) {
    throw new Error(`${method} ${table} ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
  return { status: res.status, json };
}

function parseSqlString(raw) {
  return raw.replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'");
}

function parseCourseTuples(sql) {
  const start = sql.indexOf("VALUES");
  if (start < 0) return [];
  const chunk = sql.slice(start);
  const tuples = [];
  const re =
    /\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*(\d+),\s*(true|false),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(true|false),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*([\d.]+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*now\(\)\s*\)/gs;
  let m;
  while ((m = re.exec(chunk)) !== null) {
    tuples.push({
      id: m[1],
      title: parseSqlString(`'${m[2]}'`),
      slug: m[3],
      category_id: m[4],
      subcategory: m[5],
      instructor_name: m[6],
      thumbnail_url: m[7],
      short_description: parseSqlString(`'${m[8]}'`),
      full_description: parseSqlString(`'${m[9]}'`),
      original_price_paise: Number(m[10]),
      discount_price_paise: Number(m[11]),
      is_free: m[12] === "true",
      duration_text: m[13],
      language: m[14],
      difficulty: m[15],
      status: m[16],
      is_featured: m[17] === "true",
      meta_title: parseSqlString(`'${m[18]}'`),
      meta_description: parseSqlString(`'${m[19]}'`),
      meta_keywords: parseSqlString(`'${m[20]}'`),
      rating_avg: Number(m[21]),
      rating_count: Number(m[22]),
      students_count: Number(m[23]),
      lessons_count: Number(m[24]),
      modules_count: Number(m[25]),
      published_at: new Date().toISOString(),
    });
  }
  return tuples;
}

async function upsertCourse(row) {
  const { json: existing } = await rest("GET", "courses", {
    query: `?slug=eq.${encodeURIComponent(row.slug)}&select=id,slug&limit=1`,
  });
  const payload = { ...row, updated_at: new Date().toISOString() };
  if (Array.isArray(existing) && existing[0]?.id) {
    const { id, ...patch } = payload;
    await rest("PATCH", "courses", {
      query: `?id=eq.${existing[0].id}`,
      body: patch,
      prefer: "return=minimal",
    });
    return "updated";
  }
  await rest("POST", "courses", { body: payload, prefer: "return=minimal" });
  return "inserted";
}

async function main() {
  const files = [
    "aws/scripts/67-rds-technical-category-courses.sql",
    "aws/scripts/68-rds-non-technical-category-courses.sql",
  ];
  let inserted = 0;
  let updated = 0;
  for (const rel of files) {
    const sql = fs.readFileSync(path.join(root, rel), "utf8");
    const courses = parseCourseTuples(sql);
    console.log(`${rel}: ${courses.length} courses parsed`);
    for (const course of courses) {
      const action = await upsertCourse(course);
      if (action === "inserted") inserted += 1;
      else updated += 1;
      console.log(`  ${action}: ${course.title}`);
    }
  }
  const { json: all } = await rest("GET", "courses", { query: "?select=id,title,slug" });
  console.log("\nDone:", { inserted, updated, total: Array.isArray(all) ? all.length : "?" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
