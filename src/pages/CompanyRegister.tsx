import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY_LOGIN_PATH } from "@/lib/authRoutes";
import { REGISTRATION_PASSWORD_MIN_LENGTH } from "@/lib/registrationPassword";
import { registerCompanyPartner } from "@/lib/registerCompanyPartner";
import { requestAdminLoginOtp, verifyAdminLoginOtp } from "@/lib/adminLoginOtp";
import { toast } from "sonner";
import { Building2, Loader2, Mail, ShieldCheck } from "lucide-react";

export default function CompanyRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otp, setOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);

  const [form, setForm] = useState({
    contact_name: "",
    designation: "",
    email: "",
    phone: "",
    company_name: "",
    gst_number: "",
    company_address: "",
    password: "",
  });

  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "email") {
      setEmailVerified(false);
      setOtp("");
    }
  };

  const sendOtp = async () => {
    const email = form.email.trim();
    if (!email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setOtpSending(true);
    try {
      const res = await requestAdminLoginOtp(supabase, email);
      if (!res.ok) throw res.error;
      toast.success("Verification code sent to your email");
      if (res.devOtp) toast.message(`Dev OTP: ${res.devOtp}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send OTP");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    try {
      const ok = await verifyAdminLoginOtp(supabase, form.email, otp);
      if (!ok) {
        toast.error("Invalid or expired code");
        return;
      }
      setEmailVerified(true);
      toast.success("Email verified");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailVerified) {
      toast.error("Verify your email first");
      return;
    }
    if (form.password.trim().length < REGISTRATION_PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${REGISTRATION_PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    setLoading(true);
    try {
      await registerCompanyPartner(supabase, {
        ...form,
        email_verified: true,
      });
      toast.success("Registration submitted. Admin will review your company profile.");
      navigate(COMPANY_LOGIN_PATH);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteNav />
      <main className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <Building2 className="size-10 mx-auto text-primary" />
            <h1 className="text-2xl font-bold">Company collaboration</h1>
            <p className="text-sm text-muted-foreground">
              Register your company to post jobs and hire Apna Intern candidates. Admin approval unlocks your dashboard.
            </p>
          </div>

          <Card className="p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Your name</Label>
                  <Input value={form.contact_name} onChange={(e) => setField("contact_name", e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Designation</Label>
                  <Input value={form.designation} onChange={(e) => setField("designation", e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border p-3 bg-slate-50/80">
                <Label className="flex items-center gap-2">
                  <Mail className="size-4" /> Work email {emailVerified ? <ShieldCheck className="size-4 text-emerald-600" /> : null}
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  required
                />
                {!emailVerified ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={otpSending} onClick={() => void sendOtp()}>
                      {otpSending ? <Loader2 className="size-4 animate-spin" /> : "Send OTP"}
                    </Button>
                    <Input
                      className="max-w-[140px] h-9"
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <Button type="button" size="sm" onClick={() => void verifyOtp()}>
                      Verify
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 font-medium">Email verified</p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Portal password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Company name</Label>
                <Input value={form.company_name} onChange={(e) => setField("company_name", e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>GST number</Label>
                <Input value={form.gst_number} onChange={(e) => setField("gst_number", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Company address</Label>
                <Textarea value={form.company_address} onChange={(e) => setField("company_address", e.target.value)} rows={2} required />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !emailVerified}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Submit for admin review"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Already registered?{" "}
                <Link to={COMPANY_LOGIN_PATH} className="text-primary font-medium">
                  Company login
                </Link>
              </p>
            </form>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
