#!/usr/bin/env node
/**
 * Replace non-technical internship domains on production RDS via REST.
 * Usage: REST_BASE=https://apnaintern.in/rest/v1 node scripts/replace-non-tech-domains-via-rest.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NON_TECHNICAL_INTERNSHIP_DOMAINS = fs
  .readFileSync(path.join(root, "src/lib/nonTechnicalInternshipDomains.ts"), "utf8")
  .match(/^\s*"([^"]+)"/gm)
  ?.map((line) => line.replace(/^\s*"/, "").replace(/"$/, "")) || [];

const REST_BASE =
  process.env.REST_BASE?.trim() ||
  "https://apnaintern.in/rest/v1";
const REST_KEY = process.env.RDS_ANON_KEY?.trim() || "local-anon-key";

/** Previous canonical non-tech list — remove from internship_domains when not in new list. */
const LEGACY_NON_TECH_DOMAINS = [
  "Business Management",
  "Business Administration",
  "Project Management",
  "Product Management",
  "Strategic Management",
  "General Management",
  "Startup Management",
  "International Business",
  "Supply Chain Management",
  "Logistics Management",
  "Retail Management",
  "Event Management",
  "Hospitality Management",
  "Hotel Management",
  "Tourism Management",
  "Aviation Management",
  "Sales & Marketing",
  "Sales",
  "Marketing",
  "Social Media Marketing",
  "Content Marketing",
  "Influencer Marketing",
  "Brand Management",
  "Product Marketing",
  "Performance Marketing",
  "Search Engine Optimization (SEO)",
  "Search Engine Marketing (SEM)",
  "Public Relations (PR)",
  "Advertising",
  "Market Research",
  "Customer Relationship Management (CRM)",
  "Telemarketing",
  "Business Development & Sales",
  "Retail Sales",
  "E-commerce Management",
  "Finance",
  "Accounting",
  "Auditing",
  "Taxation",
  "Banking",
  "Investment Banking",
  "Financial Planning",
  "Insurance",
  "Wealth Management",
  "Risk Management",
  "Stock Market & Equity Research",
  "Corporate Finance",
  "Cost Accounting",
  "GST",
  "Microfinance",
  "FinTech Business/Operations",
  "Human Resources (HR)",
  "Recruitment",
  "Talent Acquisition",
  "Talent Management",
  "Employee Relations",
  "Learning & Development",
  "Training & Development",
  "Payroll Management",
  "Performance Management",
  "Organizational Development",
  "HR Operations",
  "English",
  "Hindi",
  "Literature",
  "History",
  "Political Science",
  "Sociology",
  "Psychology",
  "Philosophy",
  "Geography",
  "Economics",
  "Anthropology",
  "Social Work",
  "International Relations",
  "Public Administration",
  "Development Studies",
  "Gender Studies",
  "Cultural Studies",
  "Rural Development",
  "Human Rights",
  "Journalism",
  "Mass Communication",
  "Media Studies",
  "Public Relations",
  "Corporate Communication",
  "Content Writing",
  "Copywriting",
  "Creative Writing",
  "Editing & Publishing",
  "Broadcasting",
  "Radio",
  "Television",
  "Photography",
  "Film & Media Production",
  "Digital Media",
  "Graphic Design",
  "Fashion Design",
  "Interior Design",
  "Product Design",
  "Textile Design",
  "Fashion Merchandising",
  "Animation",
  "Illustration",
  "Fine Arts",
  "Visual Arts",
  "Performing Arts",
  "Music",
  "Dance",
  "Theatre",
  "Video Production",
  "Creative Direction",
  "Teaching",
  "Education",
  "Early Childhood Education",
  "Primary Education",
  "Secondary Education",
  "Special Education",
  "Educational Psychology",
  "Curriculum Development",
  "Academic Counseling",
  "Career Counseling",
  "Educational Administration",
  "Training & Facilitation",
  "E-learning Content Development",
  "Law",
  "Legal Research",
  "Corporate Law",
  "Criminal Law",
  "Civil Law",
  "Constitutional Law",
  "Intellectual Property Law",
  "Cyber Law",
  "Labour Law",
  "Tax Law",
  "Human Rights Law",
  "Legal Compliance",
  "Legal Operations",
  "Paralegal Services",
  "Healthcare Management",
  "Hospital Administration",
  "Healthcare Operations",
  "Public Health",
  "Health Administration",
  "Medical Administration",
  "Healthcare Marketing",
  "Healthcare HR",
  "Medical Research",
  "Community Health",
  "Nutrition & Wellness",
  "Health Education",
  "Pharmaceutical Management",
  "Clinical Research",
  "Healthcare Counseling",
  "NGO Management",
  "Community Development",
  "CSR (Corporate Social Responsibility)",
  "Fundraising",
  "Volunteer Management",
  "Humanitarian Services",
  "Child Welfare",
  "Women Empowerment",
  "Youth Development",
  "Poverty Alleviation",
  "Community Outreach",
  "Nonprofit Management",
  "Social Entrepreneurship",
  "Government Affairs",
  "Public Policy",
  "Policy Research",
  "Governance",
  "Rural Administration",
  "Urban Development",
  "Development Administration",
  "Political Research",
  "Election & Political Campaign Management",
  "Government Scheme Research",
  "Environmental Management",
  "Environmental Policy",
  "Sustainability",
  "Sustainable Development",
  "Climate Change",
  "Renewable Energy Management",
  "Waste Management",
  "Environmental Awareness",
  "ESG (Environmental, Social & Governance)",
  "Conservation Management",
  "Wildlife Conservation",
  "Forestry Management",
  "Social Research",
  "Economic Research",
  "Consumer Research",
  "Academic Research",
  "Qualitative Research",
  "Survey Research",
  "Research & Documentation",
  "E-commerce Operations",
  "Customer Service",
  "Customer Support",
  "Customer Success",
  "Order Management",
  "Marketplace Management",
  "Vendor Management",
  "Procurement",
  "Inventory Management",
  "Merchandising",
  "Business Operations",
  "Administration",
  "Office Administration",
  "Executive Assistance",
  "Documentation",
  "Data Entry",
  "Translation",
  "Language Services",
  "Library Management",
  "Records Management",
  "Procurement Management",
  "Quality Management",
  "Compliance",
  "Corporate Affairs",
  "Public Affairs",
  "Personal Assistant / Executive Assistant",
  "Secretarial Services",
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
  const newDomains = [...NON_TECHNICAL_INTERNSHIP_DOMAINS];
  const newSet = new Set(newDomains);

  const { json: existingRows } = await rest("GET", "internship_domains", {
    query: "?select=id,name&limit=5000",
  });
  const existing = Array.isArray(existingRows) ? existingRows : [];

  let removed = 0;
  for (const row of existing) {
    const name = String(row.name || "");
    if (LEGACY_NON_TECH_DOMAINS.includes(name) && !newSet.has(name)) {
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

  const { json: configs } = await rest("GET", "non_engineering_university_configs", {
    query: "?select=id,university_id&limit=500",
  });
  let configsUpdated = 0;
  for (const cfg of Array.isArray(configs) ? configs : []) {
    await rest("PATCH", "non_engineering_university_configs", {
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
    nonEngineeringConfigsUpdated: configsUpdated,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
