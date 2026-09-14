#!/usr/bin/env node
/**
 * Replace technical internship domains on production RDS via REST.
 * Usage: REST_BASE=https://apnaintern.in/rest/v1 node scripts/replace-tech-domains-via-rest.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TECHNICAL_INTERNSHIP_DOMAINS = fs
  .readFileSync(path.join(root, "src/lib/technicalInternshipDomains.ts"), "utf8")
  .match(/^\s*"([^"]+)"/gm)
  ?.map((line) => line.replace(/^\s*"/, "").replace(/"$/, "")) || [];

const REST_BASE =
  process.env.REST_BASE?.trim() ||
  "https://apnaintern.in/rest/v1";
const REST_KEY = process.env.RDS_ANON_KEY?.trim() || "local-anon-key";

/** Previous canonical tech list — remove from internship_domains when not in new list. */
const LEGACY_TECH_DOMAINS = [
  "Software Development",
  "Frontend Development",
  "Backend Development",
  "Android Development",
  "iOS Development",
  "Cross-Platform App Development",
  "React.js Development",
  "Angular Development",
  "Vue.js Development",
  "Node.js Development",
  "Java Development",
  "Python Development",
  "C# / .NET Development",
  "PHP Development",
  "Laravel Development",
  "Java Spring Boot Development",
  "Flutter Development",
  "React Native Development",
  "DevOps",
  "AWS Cloud",
  "Microsoft Azure",
  "Google Cloud Platform (GCP)",
  "Cloud Architecture",
  "Ethical Hacking",
  "Network Security",
  "Information Security",
  "Application Security",
  "Penetration Testing",
  "Digital Forensics",
  "Data Science",
  "Data Analytics",
  "Data Engineering",
  "Big Data",
  "Business Intelligence",
  "Machine Learning",
  "Deep Learning",
  "Artificial Intelligence",
  "Generative AI",
  "Natural Language Processing (NLP)",
  "Computer Vision",
  "VLSI Design",
  "Semiconductor Technology",
  "FPGA Development",
  "Embedded Software",
  "Firmware Development",
  "Blockchain",
  "Web3 Development",
  "Smart Contract Development",
  "Cryptocurrency Technology",
  "Database Management",
  "SQL Development",
  "Database Administration",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Oracle Database",
  "Product Design",
  "Quality Assurance (QA)",
  "Automation Testing",
  "Manual Testing",
  "Performance Testing",
  "API Testing",
  "Game Development",
  "AR/VR Development",
  "3D Development",
  "Computer Graphics",
  "GIS & Geospatial Technology",
  "Network Engineering",
  "System Administration",
  "IT Infrastructure",
  "Technical Support / IT Support",
  "Site Reliability Engineering (SRE)",
  "Platform Engineering",
  "Kubernetes & Containerization",
  "Docker",
  "Linux Administration",
  "Enterprise Software Development",
  "ERP Development",
  "CRM Development",
  "API Development",
  "Microservices Architecture",
  "Software Architecture",
  "Solutions Architecture",
  "Automation & RPA",
  "Robotic Process Automation",
  "Data Visualization",
  "Technical Research & Development",
  "Computer Science Research",
  "Information Technology",
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
  const newDomains = [...TECHNICAL_INTERNSHIP_DOMAINS];
  const newSet = new Set(newDomains);

  const { json: existingRows } = await rest("GET", "internship_domains", {
    query: "?select=id,name&limit=5000",
  });
  const existing = Array.isArray(existingRows) ? existingRows : [];

  let removed = 0;
  for (const row of existing) {
    const name = String(row.name || "");
    if (LEGACY_TECH_DOMAINS.includes(name) && !newSet.has(name)) {
      await rest("DELETE", "internship_domains", {
        query: `?id=eq.${encodeURIComponent(row.id)}`,
        prefer: "return=minimal",
      });
      removed += 1;
      console.log("removed legacy:", name);
    }
  }

  let added = 0;
  const existingNames = new Set(existing.map((r) => String(r.name || "")));
  for (const name of newDomains) {
    if (existingNames.has(name)) continue;
    await rest("POST", "internship_domains", { body: { name }, prefer: "return=minimal" });
    added += 1;
    console.log("added:", name);
  }

  const { json: configs } = await rest("GET", "engineering_university_configs", {
    query: "?select=id,university_id&limit=500",
  });
  let configsUpdated = 0;
  for (const cfg of Array.isArray(configs) ? configs : []) {
    await rest("PATCH", "engineering_university_configs", {
      query: `?id=eq.${cfg.id}`,
      body: { domains: newDomains, updated_at: new Date().toISOString() },
      prefer: "return=minimal",
    });
    configsUpdated += 1;
  }

  console.log("\nDone:", {
    newDomainCount: newDomains.length,
    legacyRemoved: removed,
    domainsAdded: added,
    engineeringConfigsUpdated: configsUpdated,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
