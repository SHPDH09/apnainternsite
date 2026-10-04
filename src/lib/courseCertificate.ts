import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseCertificateDisplayData } from "@/components/CourseCertificateDocument";
import type { Enrollment } from "@/lib/coursesApi";

export type CourseCertificateRow = {
  id: string;
  enrollment_id: string;
  certificate_code: string;
  issued_at: string;
  template_snapshot?: Record<string, unknown> | null;
};

export type CourseCertificateVerifyResult = {
  found: boolean;
  kind: "course";
  certificateCode: string | null;
  issuedAt: string | null;
  course: {
    title?: string;
    slug?: string;
    duration_text?: string | null;
    instructor_name?: string | null;
  } | null;
  student: Record<string, unknown> | null;
};

function formatIssuedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function isCourseCertificateCode(query: string): boolean {
  return /^CRS-/i.test(query.trim());
}

export function courseCertificateDisplayFromVerify(
  result: CourseCertificateVerifyResult
): CourseCertificateDisplayData | null {
  if (!result.found || !result.certificateCode) return null;
  const studentName = String(result.student?.full_name || "Student").trim() || "Student";
  const courseTitle = String(result.course?.title || "Course").trim() || "Course";
  return {
    studentName,
    courseTitle,
    certificateCode: result.certificateCode,
    issuedAtLabel: result.issuedAt ? formatIssuedDate(result.issuedAt) : "—",
    instructorName: result.course?.instructor_name ?? null,
    durationText: result.course?.duration_text ?? null,
  };
}

export function courseCertificateDisplayFromEnrollment(
  enrollment: Enrollment,
  cert: CourseCertificateRow,
  studentName?: string | null
): CourseCertificateDisplayData {
  const course = enrollment.course;
  return {
    studentName: String(studentName || enrollment.student_name || "Student").trim() || "Student",
    courseTitle: String(course?.title || "Course").trim() || "Course",
    certificateCode: cert.certificate_code,
    issuedAtLabel: formatIssuedDate(cert.issued_at),
    instructorName: course?.instructor_name ?? null,
    durationText: course?.duration_text ?? null,
  };
}

export async function fetchCourseCertificatesByEnrollmentIds(
  client: SupabaseClient,
  enrollmentIds: string[]
): Promise<Record<string, CourseCertificateRow>> {
  const map: Record<string, CourseCertificateRow> = {};
  if (!enrollmentIds.length) return map;
  const chunk = 80;
  for (let i = 0; i < enrollmentIds.length; i += chunk) {
    const ids = enrollmentIds.slice(i, i + chunk);
    const { data, error } = await client
      .from("course_certificates")
      .select("id, enrollment_id, certificate_code, issued_at, template_snapshot")
      .in("enrollment_id", ids);
    if (error) throw error;
    for (const row of data || []) {
      const r = row as CourseCertificateRow;
      map[String(r.enrollment_id)] = r;
    }
  }
  return map;
}

export async function verifyCourseCertificatePublic(
  client: SupabaseClient,
  code: string
): Promise<CourseCertificateVerifyResult> {
  const { data, error } = await client.rpc("verify_course_certificate_public", {
    p_code: code.trim(),
  });
  if (error) throw error;

  const row = (data ?? { found: false }) as {
    found?: boolean;
    certificate_code?: string;
    issued_at?: string;
    course?: CourseCertificateVerifyResult["course"];
    student?: Record<string, unknown> | null;
  };

  if (!row.found) {
    return {
      found: false,
      kind: "course",
      certificateCode: null,
      issuedAt: null,
      course: null,
      student: null,
    };
  }

  return {
    found: true,
    kind: "course",
    certificateCode: row.certificate_code ? String(row.certificate_code) : null,
    issuedAt: row.issued_at ? String(row.issued_at) : null,
    course: row.course ?? null,
    student: row.student ?? null,
  };
}
