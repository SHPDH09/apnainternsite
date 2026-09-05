import { CheckCircle2, ShieldCheck } from "lucide-react";
import { ChangePinModal } from "@/components/ChangePinModal";
import { Button } from "@/components/ui/button";
import { StaffSecurityPanel } from "@/components/staff/StaffAccountPanels";
import {
  StudentPageHero,
  StudentSectionHeader,
} from "@/components/student/studentDashboardUi";
import { REGISTRATION_PASSWORD_MIN_LENGTH } from "@/lib/registrationPassword";

type Props = {
  currentUserId: string | null;
  settingsActive: boolean;
  onPasswordSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void | Promise<void>;
};

export function StudentSettingsView({
  currentUserId,
  settingsActive,
  onPasswordSubmit,
  onSignOut,
}: Props) {
  return (
    <div className="mx-auto max-w-lg space-y-6 student-dash-animate-in">
      <StudentPageHero
        initial="S"
        title="Account settings"
        subtitle="Manage your password and security preferences"
      />

      <div className="student-dash-card p-6 md:p-8">
        <StudentSectionHeader
          icon={ShieldCheck}
          title="Security"
          subtitle="Keep your account protected with a strong password and PIN"
        />

        {currentUserId ? (
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-medium text-slate-800">4-digit security code</p>
            <p className="mb-4 mt-1 text-xs text-slate-500">
              Used as an additional layer of protection when you sign in.
            </p>
            <ChangePinModal userId={currentUserId} />
          </div>
        ) : null}

        <form onSubmit={onPasswordSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="new_password">
              New password
            </label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none transition-all focus:border-[#5AA3E6] focus:ring-2 focus:ring-[#5AA3E6]/20"
              required
              placeholder="••••••••"
              minLength={REGISTRATION_PASSWORD_MIN_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="confirm_password">
              Confirm new password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none transition-all focus:border-[#5AA3E6] focus:ring-2 focus:ring-[#5AA3E6]/20"
              required
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            className="mt-2 h-11 w-full gap-2 rounded-lg bg-slate-800 font-medium hover:bg-slate-900"
          >
            <CheckCircle2 className="size-4" />
            Update password
          </Button>
        </form>
      </div>

      <StaffSecurityPanel isActive={settingsActive} onSignOutCurrent={onSignOut} />
    </div>
  );
}
