#!/usr/bin/env node
/**
 * Apply catalog seeds (universities, configs, internship domains) via production REST API.
 * Usage: node scripts/seed-production-catalog-via-rest.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REST_BASE =
  process.env.REST_BASE?.trim() ||
  "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging/rest/v1";
const REST_KEY = process.env.RDS_ANON_KEY?.trim() || "local-anon-key";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NON_TECH_UNIS = [
  "B.R.A. Bihar University, Muzaffarpur",
  "B.N. Mandal University, Madhepura",
  "Jai Prakash University, Chapra",
  "K.S.D. Sanskrit University, Darbhanga",
  "L.N. Mithila University, Darbhanga",
  "Magadh University, Bodh Gaya",
  "MMH Arabic & Persian University, Patna",
  "Nalanda Open University",
  "Patna University, Patna",
  "T.M. Bhagalpur University, Bhagalpur",
  "Veer Kunwar Singh University, Ara",
  "Patliputra University, Patna",
  "Munger University, Munger",
  "Purnea University, Purnea",
];

const TECH_UNIS = [
  "Aryabhatta Knowledge University, Patna",
  "Bihar Agricultural University, Sabour",
  "Bihar Animal Sciences University, Patna",
  "Bihar Engineering University, Patna",
];

const NON_TECH_COURSES = ["B.A.", "B.Sc", "B.Com", "M.A.", "M.Sc", "M.Com", "Other"];
const NON_TECH_BRANCHES = Object.fromEntries(
  NON_TECH_COURSES.map((c) => [c, ["Other"]])
);

const TECH_COURSES = ["B.Tech", "M.Tech", "Diploma", "MBA", "MCA", "Other"];
const TECH_BRANCHES_LIST = [
  "Computer Science & Engineering",
  "Artificial Intelligence & Data Science",
  "Information Technology",
  "Electronics & Communication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Other",
];
const TECH_BRANCHES = Object.fromEntries(
  TECH_COURSES.map((c) => [c, c === "MBA" || c === "MCA" || c === "Other" ? ["Other"] : [...TECH_BRANCHES_LIST]])
);

function parseDomainNamesFromSql(relPath) {
  const fp = path.join(root, relPath);
  const sql = fs.readFileSync(fp, "utf8");
  const names = [];
  for (const m of sql.matchAll(/\('([^']+)'\)/g)) {
    const name = m[1]?.trim();
    if (name && !name.includes("::") && name.length > 2) names.push(name);
  }
  return [...new Set(names)];
}

async function rest(method, table, { query = "", body, prefer = "return=representation" } = {}) {
  const url = `${REST_BASE}/${table}${query}`;
  const res = await fetch(url, {
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

async function findUniversityByName(name) {
  const enc = encodeURIComponent(name);
  const { json } = await rest("GET", "universities", {
    query: `?name=eq.${enc}&select=id,name&limit=1`,
    prefer: "return=representation",
  });
  return Array.isArray(json) && json[0] ? json[0] : null;
}

async function ensureUniversity(name) {
  const existing = await findUniversityByName(name);
  if (existing?.id) return existing;
  const { json } = await rest("POST", "universities", { body: { name }, prefer: "return=representation" });
  return json;
}

async function ensureNonEngConfig(universityId) {
  const { json: rows } = await rest("GET", "non_engineering_university_configs", {
    query: `?university_id=eq.${universityId}&select=id,courses&limit=1`,
  });
  if (Array.isArray(rows) && rows[0]?.id) {
    const empty = !rows[0].courses?.length;
    if (empty) {
      await rest("PATCH", "non_engineering_university_configs", {
        query: `?id=eq.${rows[0].id}`,
        body: {
          courses: NON_TECH_COURSES,
          branches_by_course: NON_TECH_BRANCHES,
          domains: [],
          is_active: true,
        },
        prefer: "return=minimal",
      });
    }
    return rows[0].id;
  }
  const { json } = await rest("POST", "non_engineering_university_configs", {
    body: {
      university_id: universityId,
      courses: NON_TECH_COURSES,
      branches_by_course: NON_TECH_BRANCHES,
      domains: [],
      is_active: true,
    },
  });
  return json?.id;
}

async function ensureEngConfig(universityId) {
  const { json: rows } = await rest("GET", "engineering_university_configs", {
    query: `?university_id=eq.${universityId}&select=id,courses&limit=1`,
  });
  if (Array.isArray(rows) && rows[0]?.id) {
    const empty = !rows[0].courses?.length;
    if (empty) {
      await rest("PATCH", "engineering_university_configs", {
        query: `?id=eq.${rows[0].id}`,
        body: {
          courses: TECH_COURSES,
          branches_by_course: TECH_BRANCHES,
          domains: [],
          is_active: true,
        },
        prefer: "return=minimal",
      });
    }
    return rows[0].id;
  }
  const { json } = await rest("POST", "engineering_university_configs", {
    body: {
      university_id: universityId,
      courses: TECH_COURSES,
      branches_by_course: TECH_BRANCHES,
      domains: [],
      is_active: true,
    },
  });
  return json?.id;
}

async function ensureDomain(name) {
  const enc = encodeURIComponent(name);
  const { json: rows } = await rest("GET", "internship_domains", {
    query: `?name=eq.${enc}&select=id&limit=1`,
  });
  if (Array.isArray(rows) && rows[0]?.id) return false;
  await rest("POST", "internship_domains", { body: { name }, prefer: "return=minimal" });
  return true;
}

async function main() {
  console.log("REST base:", REST_BASE);

  let uniAdded = 0;
  let nonTechCfg = 0;
  let techCfg = 0;

  for (const name of NON_TECH_UNIS) {
    const before = await findUniversityByName(name);
    const uni = await ensureUniversity(name);
    if (!before?.id) uniAdded += 1;
    await ensureNonEngConfig(uni.id);
    nonTechCfg += 1;
    console.log("non-tech:", name);
  }

  for (const name of TECH_UNIS) {
    const before = await findUniversityByName(name);
    const uni = await ensureUniversity(name);
    if (!before?.id) uniAdded += 1;
    await ensureEngConfig(uni.id);
    techCfg += 1;
    console.log("tech:", name);
  }

  // BEU backfill
  const beu = await findUniversityByName("BEU");
  if (beu?.id) {
    await ensureEngConfig(beu.id);
    console.log("tech: BEU (backfill)");
  }

  const techDomains = parseDomainNamesFromSql("aws/scripts/65-rds-technical-internship-domains.sql");
  const nonTechDomains = parseDomainNamesFromSql("aws/scripts/66-rds-non-technical-internship-domains.sql");
  const allDomains = [...new Set([...techDomains, ...nonTechDomains])];

  let domainsAdded = 0;
  for (const name of allDomains) {
    if (await ensureDomain(name)) domainsAdded += 1;
  }

  // Merge technical domains into engineering configs (BEU + Bihar tech)
  for (const name of [...TECH_UNIS, "BEU"]) {
    const uni = await findUniversityByName(name);
    if (!uni?.id) continue;
    const { json: rows } = await rest("GET", "engineering_university_configs", {
      query: `?university_id=eq.${uni.id}&select=id,domains&limit=1`,
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.id) continue;
    const merged = [...new Set([...(row.domains || []), ...techDomains])].sort();
    await rest("PATCH", "engineering_university_configs", {
      query: `?id=eq.${row.id}`,
      body: { domains: merged },
      prefer: "return=minimal",
    });
  }

  const { json: domainCount } = await rest("GET", "internship_domains", {
    query: "?select=id",
    prefer: "count=exact",
  });

  console.log("\nDone:", {
    universitiesAdded: uniAdded,
    nonTechConfigs: nonTechCfg,
    techConfigs: techCfg,
    domainsAdded,
    domainTotal: Array.isArray(domainCount) ? domainCount.length : "?",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
