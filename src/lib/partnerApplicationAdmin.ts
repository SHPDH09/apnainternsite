import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createReferralPartnerWithoutServiceRole,
  generateReferralPartnerLoginCode,
} from "@/lib/createSubUser";
import {
  buildReferralAssignmentRows,
  generateReferralCode,
} from "@/lib/referral";
import { fetchAllCollegesCatalog, resolveUniversityId } from "@/lib/institutionCatalog";
import { displayCollegeName } from "@/lib/collegeDisplay";
import type { PartnerApplicationRow } from "@/lib/partnerApplications";
import { shouldCreateCouponOnApproval } from "@/lib/partnerApplications";
import { createReferralCouponFromPayload, generateCouponCode } from "@/lib/referralCoupons";

async function savePartnerAssignments(
  client: SupabaseClient,
  partnerId: string,
  universityNames: string[],
  collegeNames: string[]
): Promise<void> {
  if (!universityNames.length) return;

  const [{ data: uniData }, collegeRows] = await Promise.all([
    client.from("universities").select("id, name").order("name"),
    fetchAllCollegesCatalog(client),
  ]);
  const unis = (uniData || []) as Array<{ id: string; name: string }>;
  const universityIds = universityNames
    .map((n) => resolveUniversityId(unis, n))
    .filter(Boolean) as string[];
  if (!universityIds.length) return;

  const collegeIds = collegeRows
    .filter((c) => {
      const display = displayCollegeName(c.name);
      return collegeNames.includes(display) || collegeNames.includes(c.name);
    })
    .filter((c) => universityIds.includes(String(c.university_id)))
    .map((c) => String(c.id));

  const rowsToInsert = buildReferralAssignmentRows({
    partnerId,
    universityIds,
    collegeIds,
    colleges: collegeRows,
  });
  if (!rowsToInsert.length) return;

  const { error } = await client.from("referral_partner_assignments").insert(rowsToInsert);
  if (error && !/42P01|does not exist/i.test(error.message || "")) throw error;
}

async function linkReferralPartnerPortal(
  client: SupabaseClient,
  params: {
    userId: string;
    partnerId: string;
    email: string;
    fullName: string;
    loginSecret: string;
  }
): Promise<void> {
  const { error: linkErr } = await client.rpc("link_referral_partner_portal", {
    target_user_id: params.userId,
    p_partner_id: params.partnerId,
    partner_email: params.email.trim().toLowerCase(),
    partner_full_name: params.fullName.trim(),
    p_login_secret: params.loginSecret.trim(),
  });

  if (!linkErr) {
    const { error: pwdErr } = await client.rpc("admin_reset_user_password", {
      target_user_id: params.userId,
      new_pass: params.loginSecret.trim(),
    });
    if (pwdErr && !/admin_reset_user_password|does not exist|42883/i.test(pwdErr.message || "")) {
      throw new Error(pwdErr.message || "Could not set promoter login password");
    }
    return;
  }

  const msg = linkErr.message || "";
  if (!/link_referral_partner_portal|does not exist|42883/i.test(msg)) {
    await createReferralPartnerWithoutServiceRole(client, {
      email: params.email,
      loginSecret: params.loginSecret,
      partnerId: params.partnerId,
      fullName: params.fullName,
    });
    return;
  }

  throw new Error(
    "Referral portal link is not set up on the database yet. Apply aws/scripts/61-rds-referral-partner-portal-sync.sql"
  );
}

export async function approvePartnerApplication(
  client: SupabaseClient,
  app: PartnerApplicationRow,
  reviewerId: string
): Promise<{ redirectKind: PartnerApplicationRow["partner_kind"]; recordId: string }> {
  const payload = app.payload || {};

  if (app.partner_kind === "cyber_cafe") {
    const { data: cafe } = await client
      .from("cybercafe_profiles")
      .select("id")
      .eq("email", app.email)
      .maybeSingle();
    if (cafe?.id) {
      await client
        .from("cybercafe_profiles")
        .update({ status: "approved", rejection_reason: null })
        .eq("id", cafe.id);
    }
    await client
      .from("partner_applications")
      .update({
        status: "approved",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        approved_record_id: cafe?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", app.id);
    return { redirectKind: "cyber_cafe", recordId: String(cafe?.id || "") };
  }

  let code = generateReferralCode();
  let inserted: { id: string; referral_code: string } | null = null;

  const { data: existingPartner } = await client
    .from("referral_partners")
    .select("id, referral_code")
    .ilike("email", app.email.trim())
    .maybeSingle();

  if (existingPartner?.id && existingPartner.referral_code) {
    inserted = {
      id: String(existingPartner.id),
      referral_code: String(existingPartner.referral_code),
    };
  } else {
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data, error } = await client
        .from("referral_partners")
        .insert({
          full_name: app.full_name,
          email: app.email,
          contact_number: app.contact_number || "",
          city: String(payload.city || "").trim() || null,
          college_name: String(payload.college_name || payload.colleges?.[0] || "").trim() || null,
          referral_type: String(payload.referral_type || "partner"),
          referral_code: code,
          active: true,
        })
        .select("id, referral_code")
        .single();
      if (!error && data) {
        inserted = data;
        break;
      }
      if (error?.code === "23505" && /referral_code/i.test(error.message || "")) {
        code = generateReferralCode();
        continue;
      }
      throw error;
    }
  }
  if (!inserted) throw new Error("Could not create referral partner record");

  const universities = Array.isArray(payload.universities)
    ? payload.universities.map(String).filter(Boolean)
    : payload.university_name
      ? [String(payload.university_name)]
      : [];
  const colleges = Array.isArray(payload.colleges)
    ? payload.colleges.map(String).filter(Boolean)
    : payload.college_name
      ? [String(payload.college_name)]
      : [];

  if (universities.length) {
    await savePartnerAssignments(client, inserted.id, universities, colleges);
  }

  const loginSecret = generateReferralPartnerLoginCode();
  await linkReferralPartnerPortal(client, {
    userId: app.auth_user_id,
    partnerId: inserted.id,
    email: app.email,
    fullName: app.full_name,
    loginSecret,
  });

  if (shouldCreateCouponOnApproval(app.partner_kind, payload)) {
    await createReferralCouponFromPayload(client, {
      referralPartnerId: inserted.id,
      applicationId: app.id,
      payload,
      couponCode: String(payload.coupon_code || generateCouponCode()),
    });
  }

  await client
    .from("partner_applications")
    .update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      approved_record_id: inserted.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", app.id);

  return { redirectKind: app.partner_kind, recordId: inserted.id };
}

export async function rejectPartnerApplication(
  client: SupabaseClient,
  app: PartnerApplicationRow,
  reviewerId: string,
  reason: string
): Promise<void> {
  await client
    .from("partner_applications")
    .update({
      status: "rejected",
      rejection_reason: reason.trim() || "Application rejected",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", app.id);

  if (app.partner_kind === "cyber_cafe") {
    await client
      .from("cybercafe_profiles")
      .update({ status: "rejected", rejection_reason: reason.trim() || null })
      .eq("email", app.email);
  }
}

export async function approveCybercafeProfile(
  client: SupabaseClient,
  profileId: string
): Promise<void> {
  await client
    .from("cybercafe_profiles")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", profileId);
}
