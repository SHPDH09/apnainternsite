#!/usr/bin/env node
/**
 * Smoke-test API surface used by Admin / Staff / Student dashboards (no browser).
 * Usage: node scripts/portal-smoke.mjs [origin]
 */
const origin = (process.argv[2] || process.env.PORTAL_SMOKE_ORIGIN || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

const checks = [];

async function get(path) {
  const res = await fetch(`${origin}${path}`, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text: text.slice(0, 200) };
}

async function run() {
  const health = await get("/api/health");
  checks.push({
    name: "GET /api/health",
    ok: health.status === 200 && health.json?.ok === true,
    detail: String(health.status),
  });

  const blogPosts = await get("/api/admin-blog-posts");
  checks.push({
    name: "GET /api/admin-blog-posts (no auth)",
    ok: blogPosts.status === 401,
    detail: String(blogPosts.status),
  });

  const blogLeads = await get("/api/admin-blog-leads?page=0&pageSize=5");
  checks.push({
    name: "GET /api/admin-blog-leads (no auth)",
    ok: blogLeads.status === 401,
    detail: String(blogLeads.status),
  });

  const restBlog = await get(
    "/rest/v1/site_blog_posts?select=id,title&is_active=eq.true&limit=3"
  );
  checks.push({
    name: "GET /rest/v1/site_blog_posts (public list)",
    ok: restBlog.status === 200 && Array.isArray(restBlog.json),
    detail: `${restBlog.status} rows=${Array.isArray(restBlog.json) ? restBlog.json.length : "?"}`,
  });

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(c.ok ? "OK  " : "FAIL", c.name, "-", c.detail);
  }
  if (failed.length) {
    process.exitCode = 1;
    console.error(`\n${failed.length} check(s) failed`);
  } else {
    console.log(`\nAll ${checks.length} checks passed`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
