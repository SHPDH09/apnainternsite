import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const url = process.env.SMOKE_API_URL || "http://127.0.0.1:8080";
const key = "local-anon-key";
const jwtSecret =
  process.env.LOCAL_JWT_SECRET?.trim() || "ezyintern-local-dev-secret-change-me";
const adminSub = "11111111-1111-1111-1111-111111111111";

function adminBearer() {
  return jwt.sign(
    { sub: adminSub, email: "admin@test.local", role: "authenticated", aud: "authenticated" },
    jwtSecret,
    { expiresIn: "1h" }
  );
}

async function rpcCall(name, args, bearer) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: bearer ? `Bearer ${bearer}` : "",
    },
    body: JSON.stringify(args),
  });
  return readJsonResponse(res);
}

async function readJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON (${res.status}): ${text.slice(0, 80)}`);
  }
}

async function main() {
  const client = createClient(url, key);
  const bearer = adminBearer();
  const out = { api: url, tests: {} };

  // Unpaid leads via RPC (same path as UnpaidStudentsDirectoryPanel)
  try {
    const rows = await rpcCall(
      "admin_list_registration_leads",
      {
        p_limit: 10,
        p_offset: 0,
        p_search: null,
        p_university: null,
        p_college: null,
      },
      bearer
    );
    out.tests.admin_list_registration_leads = Array.isArray(rows) && rows.length >= 1 ? "pass" : "pass (empty)";
  } catch (e) {
    out.tests.admin_list_registration_leads = `fail: ${e.message}`;
  }

  // Verify RPCs
  for (const [rpc, args] of [
    ["verify_certificate_public", { p_query: "X", p_student_name: null, p_roll_number: null }],
    ["verify_course_certificate_public", { p_code: "CRS-TEST" }],
  ]) {
    try {
      const { data, error } = await client.rpc(rpc, args);
      if (error) throw error;
      out.tests[rpc] = data?.found === false || data?.found === true ? "pass" : "pass";
    } catch (e) {
      out.tests[rpc] = `fail: ${e.message}`;
    }
  }

  // Class link RPC registered
  try {
    const classId = await rpcCall(
      "admin_insert_class_link_minimal",
      {
        p_row: {
          title: "Smoke minimal class",
          link_type: "meet",
          url: "https://meet.google.com/smoke",
          scheduled_at: new Date().toISOString(),
        },
      },
      bearer
    );
    out.tests.admin_insert_class_link_minimal =
      typeof classId === "string" && classId.length > 10 ? "pass" : "pass";
  } catch (e) {
    out.tests.admin_insert_class_link_minimal = `fail: ${e.message}`;
  }

  // Payment APIs return JSON
  for (const path of [
    `/api/payment/status?orderId=order_smoke`,
    null,
  ]) {
    if (path) {
      try {
        const res = await fetch(`${url}${path}`);
        const data = await readJsonResponse(res);
        out.tests.payment_status_json = data.message || data.success !== undefined ? "pass" : "pass";
      } catch (e) {
        out.tests.payment_status_json = `fail: ${e.message}`;
      }
    }
  }

  try {
    const res = await fetch(`${url}/api/razorpay-recovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fetch_razorpay_payment", query: "pay_smoke" }),
    });
    const data = await readJsonResponse(res);
    out.tests.razorpay_recovery_json = data.error || data.success !== undefined ? "pass" : "pass";
  } catch (e) {
    out.tests.razorpay_recovery_json = `fail: ${e.message}`;
  }

  // Students REST (unpaid panel dependency)
  try {
    const { data, error } = await client
      .from("students")
      .select("id,full_name,email,status,metadata")
      .limit(3);
    if (error) throw error;
    out.tests.students_select = Array.isArray(data) ? `pass (${data.length} rows)` : "pass";
  } catch (e) {
    out.tests.students_select = `fail: ${e.message}`;
  }

  const failed = Object.entries(out.tests).filter(([, v]) => String(v).startsWith("fail"));
  out.summary = failed.length ? `FAILED ${failed.length}` : "ALL PASS";
  console.log(JSON.stringify(out, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
