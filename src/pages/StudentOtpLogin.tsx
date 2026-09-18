import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { LoginPremiumLayout } from "@/components/login/LoginPremiumLayout";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { supabase } from "@/integrations/supabase/client";
import { resolveLoginIdentifier } from "@/lib/resolveLoginIdentifier";
import { finishPortalLoginAfterAuth } from "@/lib/finishPortalLogin";
import { persistStudentAuthSession } from "@/lib/studentAuthSession";
import { STUDENT_LOGIN_PATH } from "@/lib/authRoutes";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function StudentOtpLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [resolvedEmail, setResolvedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"identifier" | "otp">("identifier");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams(location.search);
      if (params.get("portal") === "student") {
        await supabase.auth.signOut();
        if (!cancelled) navigate(STUDENT_LOGIN_PATH, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.search, navigate]);

  const resolveEmail = async () => {
    const result = await resolveLoginIdentifier(supabase, identifier);
    if (!result.ok) throw new Error(result.message);
    return result.email;
  };

  const sendOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    if (cooldown > 0) return;
    setLoading(true);
    try {
      const email = await resolveEmail();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setResolvedEmail(email);
      setOtp("");
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(`Verification code sent to ${email}.`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      toast.error("Enter the 6-digit verification code.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: resolvedEmail,
        token: otp,
        type: "email",
      });
      if (error) throw error;
      if (!data.user || !data.session) throw new Error("Authentication session was not created.");

      const finish = await finishPortalLoginAfterAuth(supabase, data.user, {
        isCollegeLoginRoute: false,
        isReferralLoginRoute: false,
        isAdminLoginRoute: false,
      });
      if (!finish.ok) {
        await supabase.auth.signOut();
        throw new Error(finish.message);
      }
      await persistStudentAuthSession(supabase);
      toast.success("Welcome back!");
      navigate(finish.destination, { replace: true });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />
      <main className="flex-1">
        <LoginPremiumLayout
          title="Student sign-in"
          subtitle="Sign in securely with a one-time verification code — no password required."
          badge="Passwordless student access"
        >
          {step === "identifier" ? (
            <form onSubmit={sendOtp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="student-identifier">Email, mobile, or registration / roll number</Label>
                <Input
                  id="student-identifier"
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="Email, mobile, API/INT/2026/… or roll no."
                  className="h-12 bg-slate-50 border-none shadow-inner rounded-xl pl-4"
                  autoComplete="username"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12 rounded-xl font-black" disabled={loading || !identifier.trim()}>
                {loading && <Loader2 className="size-5 animate-spin mr-2" />}
                Send verification code
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                <MailCheck className="inline-block size-4 mr-2 align-[-2px]" />
                Enter the 6-digit code sent to <strong>{resolvedEmail}</strong>.
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={OTP_LENGTH} value={otp} onChange={setOtp} autoFocus>
                  <InputOTPGroup>
                    {Array.from({ length: OTP_LENGTH }, (_, index) => <InputOTPSlot key={index} index={index} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full h-12 rounded-xl font-black" disabled={loading || otp.length !== OTP_LENGTH}>
                {loading && <Loader2 className="size-5 animate-spin mr-2" />}
                Verify and sign in
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setStep("identifier"); setOtp(""); }}>
                  Change identifier
                </button>
                <button type="button" className="font-semibold text-primary hover:underline disabled:opacity-50" disabled={loading || cooldown > 0} onClick={() => void sendOtp()}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
          <p className="text-center text-sm text-muted-foreground mt-6">
            New user? <Link to="/register" className="text-primary font-semibold hover:underline">Register here</Link>
          </p>
        </LoginPremiumLayout>
      </main>
      <SiteFooter />
    </div>
  );
}
