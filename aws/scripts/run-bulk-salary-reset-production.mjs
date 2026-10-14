#!/usr/bin/env node
/** POST bulk ungenerate to production send-mail (after Vercel deploy). */
const PAYLOAD = {
  action: "bulk_ungenerate_staff_salary",
  code: process.env.RDS_APPLY_CODE || "apnaintern-owner-setup-v1",
  months: (process.env.MONTHS || "2026-06,2026-07,2026-08,2026-09").split(/[,;\s]+/).filter(Boolean),
};

const origin = (process.env.SITE_ORIGIN || "https://apnaintern.in").replace(/\/$/, "");
const res = await fetch(`${origin}/api/send-mail`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(PAYLOAD),
});
const text = await res.text();
console.log(res.status, text);
