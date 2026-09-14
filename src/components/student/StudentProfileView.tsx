import {
  Award,
  CheckCircle2,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  Phone,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StudentOutlineButton,
  StudentPageHero,
  StudentPrimaryButton,
  StudentProfileField,
  StudentSectionHeader,
} from "@/components/student/studentDashboardUi";
import { isBnmuStudent } from "@/lib/feeRules";
import { resolveBnmuUniversityRollNumber } from "@/lib/certificateFormat";

type Props = {
  profile: Record<string, unknown> | null;
  registrationLabel: string;
  studentProfileEditLocked: boolean;
  onEditProfile: () => void;
  onOfferLetter: () => void;
  onReceipt: () => void;
  onCertificate: () => void;
  certificatesEnabled: boolean;
  hasCertificate: boolean;
  certificateReady: boolean;
};

export function StudentProfileView({
  profile,
  registrationLabel,
  studentProfileEditLocked,
  onEditProfile,
  onOfferLetter,
  onReceipt,
  onCertificate,
  certificatesEnabled,
  hasCertificate,
  certificateReady,
}: Props) {
  const firstName = String(profile?.full_name || "Student").split(" ")[0];
  const initial = String(profile?.full_name || "S").charAt(0).toUpperCase();

  return (
    <div className="space-y-8 student-dash-animate-in">
      <StudentPageHero
        initial={initial}
        title={`${firstName}'s profile`}
        subtitle={
          <span className="font-mono text-xs text-slate-500">{registrationLabel}</span>
        }
        actions={
          !studentProfileEditLocked ? (
            <StudentOutlineButton onClick={onEditProfile}>
              <Edit2 className="size-4" />
              Edit profile
            </StudentOutlineButton>
          ) : null
        }
      />

      <div id="profile-section" className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="student-dash-card border-l-[3px] border-l-[#5AA3E6] p-6 md:p-8">
            <StudentSectionHeader
              icon={User}
              title="Personal profile"
              subtitle="Your contact and identity details"
            />
            <div className="grid gap-6 md:grid-cols-2">
              <StudentProfileField label="Full name" value={profile?.full_name as string} />
              <StudentProfileField label="Email address" value={profile?.email as string} />
              <StudentProfileField label="Contact number" value={profile?.contact_number as string} />
              <StudentProfileField label="Gender" value={profile?.gender as string} />
              <StudentProfileField
                label="Parent / guardian name"
                value={(profile?.parent_name || profile?.father_name) as string}
              />
            </div>
          </div>

          <div className="student-dash-card border-l-[3px] border-l-violet-500 p-6 md:p-8">
            <StudentSectionHeader
              icon={GraduationCap}
              title="Academic information"
              subtitle="University, college, and programme details"
            />
            <div className="grid gap-6 md:grid-cols-2">
              <StudentProfileField label="University" value={profile?.university_name as string} />
              <StudentProfileField label="College" value={profile?.college_name as string} />
              <StudentProfileField label="Degree program" value={profile?.degree as string} />
              <StudentProfileField label="Department" value={profile?.department as string} />
              <StudentProfileField
                label="Major / subject"
                value={(profile?.subject || (profile?.metadata as Record<string, unknown>)?.subject) as string}
              />
              <StudentProfileField label="Academic session" value={profile?.academic_session as string} />
              <StudentProfileField
                label="Class / semester"
                value={(profile?.class_semester || profile?.class_sem) as string}
              />
              <StudentProfileField label="Registration no." value={profile?.roll_number as string} />
              {isBnmuStudent(profile?.university_name as string) ? (
                <StudentProfileField
                  label="Roll no."
                  value={
                    (profile?.university_roll_number ||
                      resolveBnmuUniversityRollNumber(profile)) as string
                  }
                />
              ) : null}
              <div className="md:col-span-2 rounded-lg border border-[#5AA3E6]/20 bg-slate-50/80 p-4">
                <p className="text-xs font-medium text-slate-500">Internship domain</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {(profile?.course || profile?.internship_domain) as string || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="student-dash-card border-l-[3px] border-l-amber-500 p-6 md:p-8">
            <StudentSectionHeader icon={Phone} title="Emergency contact" />
            <div className="space-y-5">
              <StudentProfileField label="Contact name" value={profile?.emergency_name as string} />
              <StudentProfileField label="Phone" value={profile?.emergency_contact as string} />
              <StudentProfileField label="Relationship" value={profile?.emergency_relation as string} />
            </div>
          </div>

          <div className="student-dash-card p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl student-dash-hero-accent text-white">
                <Award className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Status: Active</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  You are enrolled in the internship programme. Your progress is tracked by the team.
                </p>
              </div>
            </div>
          </div>

          <div className="student-dash-card p-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Support</h3>
            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              Need help with your internship or the portal? Our support team can assist you.
            </p>
            <StudentOutlineButton className="w-full">
              <ExternalLink className="size-4" />
              Contact support
            </StudentOutlineButton>
          </div>
        </div>
      </div>

      <div className="student-dash-card border-l-[3px] border-l-teal-600 p-6 md:p-8">
        <StudentSectionHeader
          icon={FileText}
          title="Internship documents"
          subtitle="Official offer letter, payment receipt, and certificate"
        />
        <div className="flex flex-wrap gap-3">
          <StudentPrimaryButton onClick={onOfferLetter}>
            <Download className="size-4" />
            Offer letter
          </StudentPrimaryButton>
          <StudentOutlineButton onClick={onReceipt}>
            <FileText className="size-4" />
            Payment receipt
          </StudentOutlineButton>
          {certificatesEnabled ? (
            hasCertificate ? (
              <StudentPrimaryButton onClick={onCertificate}>
                <Award className="size-4" />
                View certificate
              </StudentPrimaryButton>
            ) : (
              <Button
                variant="outline"
                disabled
                className="h-10 cursor-not-allowed gap-2 rounded-lg border-dashed border-slate-300 text-slate-400"
              >
                <Award className="size-4" />
                Certificate not ready
              </Button>
            )
          ) : null}
        </div>
        {certificatesEnabled ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
            {!certificateReady ? (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin text-[#5AA3E6]" />
                Your certificate will be issued after the evaluation phase.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="size-4" />
                Your certificate is ready for download.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
