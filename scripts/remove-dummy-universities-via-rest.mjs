#!/usr/bin/env node
/**
 * Remove dummy / test universities from production RDS via REST.
 * Usage: REST_BASE=https://apnaintern.in/rest/v1 node scripts/remove-dummy-universities-via-rest.mjs
 */
const REST_BASE =
  process.env.REST_BASE?.trim() ||
  "https://apnaintern.in/rest/v1";
const REST_KEY = process.env.RDS_ANON_KEY?.trim() || "local-anon-key";

/** Exact dummy names to remove (real BEU entries are kept). */
const DUMMY_UNIVERSITY_NAMES = [
  "BEU",
  "duplicate test uni",
  "Duplicate Test Uni",
  "test LNMU",
];

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

async function main() {
  console.log("REST base:", REST_BASE);

  const { json: allUnis } = await rest("GET", "universities", {
    query: "?select=id,name&limit=500",
  });
  const targets = (Array.isArray(allUnis) ? allUnis : []).filter((u) =>
    DUMMY_UNIVERSITY_NAMES.includes(String(u.name || ""))
  );

  if (!targets.length) {
    console.log("No dummy universities found.");
    return;
  }

  let collegesRemoved = 0;
  let configsRemoved = 0;
  let unisRemoved = 0;

  for (const uni of targets) {
    const id = String(uni.id);
    const name = String(uni.name);

    const { json: colleges } = await rest("GET", "colleges", {
      query: `?select=id,name&university_id=eq.${encodeURIComponent(id)}`,
    });
    for (const col of Array.isArray(colleges) ? colleges : []) {
      await rest("DELETE", "colleges", {
        query: `?id=eq.${encodeURIComponent(col.id)}`,
        prefer: "return=minimal",
      });
      collegesRemoved += 1;
      console.log("removed college:", col.name, `(from ${name})`);
    }

    for (const table of ["engineering_university_configs", "non_engineering_university_configs"]) {
      const { json: configs } = await rest("GET", table, {
        query: `?select=id&university_id=eq.${encodeURIComponent(id)}`,
      });
      for (const cfg of Array.isArray(configs) ? configs : []) {
        await rest("DELETE", table, {
          query: `?id=eq.${encodeURIComponent(cfg.id)}`,
          prefer: "return=minimal",
        });
        configsRemoved += 1;
        console.log("removed config:", table, `(from ${name})`);
      }
    }

    await rest("DELETE", "universities", {
      query: `?id=eq.${encodeURIComponent(id)}`,
      prefer: "return=minimal",
    });
    unisRemoved += 1;
    console.log("removed university:", name);
  }

  console.log("\nDone:", {
    universitiesRemoved: unisRemoved,
    collegesRemoved,
    configsRemoved,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
