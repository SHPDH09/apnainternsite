import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Store, Share2, Ticket, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { REGISTRATION_PASSWORD_MIN_LENGTH } from "@/lib/registrationPassword";
import {
  PARTNER_KIND_LABELS,
  REFERRAL_APPLY_MODE_OPTIONS,
  submitPartnerApplication,
  type PartnerKind,
  type ReferralApplyMode,
} from "@/lib/partnerApplications";
import {
  clearPartnerVerifiedEmail,
  isPartnerEmailVerified,
  sendPartnerRegistrationOtp,
  verifyPartnerRegistrationOtp,
} from "@/lib/partnerEmailOtp";
import { REFERRAL_TYPE_OPTIONS } from "@/lib/referral";
import { fetchAllCollegesCatalog } from "@/lib/institutionCatalog";
import { MultiSelectCheckboxGroup } from "@/components/admin/MultiSelectCheckboxGroup";
import { collegesForUniversityNames } from "@/lib/classLinkTargeting";
import { cn } from "@/lib/utils";
import { isLocalDevEnvironment } from "@/lib/isLocalDev";

const PARTNER_TABS: Array<{ kind: PartnerKind; label: string; icon: typeof Store }> = [
  { kind: "referral", label: "Referral", icon: Share2 },
  { kind: "cyber_cafe", label: "Cyber Cafe", icon: Store },
  { kind: "coupon", label: "Coupon", icon: Ticket },
];

function parsePartnerKind(raw: string | null): PartnerKind {
  if (raw === "cyber_cafe" || raw === "referral" || raw === "coupon") return raw;
  return "referral";
}

export default function PartnerRegister() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kind = parsePartnerKind(params.get("type"));
  const activeTab = PARTNER_TABS.find((t) => t.kind === kind) || PARTNER_TABS[0];
  const Icon = activeTab.icon;

  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const [unis, setUnis] = useState<Array<{ id: string; name: string }>>([]);
  const [colleges, setColleges] = useState<Array<{ id: string; name: string; university_id: string }>>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [shopName, setShopName] = useState("");
  const [city, setCity] = useState("");
  const [referralType, setReferralType] = useState("partner");
  const [referralApplyMode, setReferralApplyMode] = useState<ReferralApplyMode>("referral_only");
  const [selectedUnis, setSelectedUnis] = useState<string[]>([]);
  const [selectedColleges, setSelectedColleges] = useState<string[]>([]);

  const formTitle =
    kind === "referral"
      ? REFERRAL_APPLY_MODE_OPTIONS.find((o) => o.value === referralApplyMode)?.label ?? "Referral Partner"
      : PARTNER_KIND_LABELS[kind];

  useEffect(() => {
    void (async () => {
      const [{ data: uniData }, collegeRows] = await Promise.all([
        supabase.from("universities").select("id, name").order("name"),
        fetchAllCollegesCatalog(supabase),
      ]);
      setUnis((uniData || []) as Array<{ id: string; name: string }>);
      setColleges(collegeRows);
    })();
  }, []);

  useEffect(() => {
    setEmailVerified(isPartnerEmailVerified(email));
    if (!isPartnerEmailVerified(email)) {
      setOtpCode("");
      setDevOtpHint(null);
    }
  }, [email]);

  const collegeOptions = useMemo(
    () => collegesForUniversityNames(colleges, unis, selectedUnis),
    [colleges, unis, selectedUnis]
  );

  const switchKind = (next: PartnerKind) => {
    setParams({ type: next }, { replace: true });
  };

  const handleSendOtp = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      toast.error("Enter a valid email before requesting a code.");
      return;
    }
    setOtpSending(true);
    try {
      clearPartnerVerifiedEmail();
      setEmailVerified(false);
      const result = await sendPartnerRegistrationOtp(supabase, normalized);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.devOtp && isLocalDevEnvironment()) {
        setDevOtpHint(result.devOtp);
      }
      toast.success("Verification code sent to your email.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpVerifying(true);
    try {
      const result = await verifyPartnerRegistrationOtp(supabase, email, otpCode);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEmailVerified(true);
      toast.success("Email verified. You can submit your application.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim() || !contact.trim() || !address.trim()) {
      toast.error("Name, email, phone, address, and password are required.");
      return;
    }
    if (!emailVerified || !isPartnerEmailVerified(email)) {
      toast.error("Verify your email with the OTP code before submitting.");
      return;
    }
    if (password.trim().length < REGISTRATION_PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${REGISTRATION_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    const payload: Record<string, unknown> = {
      address: address.trim(),
      city: city.trim() || null,
    };

    if (kind === "cyber_cafe") {
      if (!shopName.trim()) {
        toast.error("Shop name is required for cyber cafe partners.");
        return;
      }
      payload.shop_name = shopName.trim();
      payload.location = address.trim();
    } else {
      payload.universities = selectedUnis;
      payload.colleges = selectedColleges;
      payload.referral_type = referralType;
      payload.university_name = selectedUnis[0] || null;
      payload.college_name = selectedColleges[0] || null;
    }

    if (kind === "referral") {
      payload.referral_apply_mode = referralApplyMode;
    }

    setLoading(true);
    try {
      await submitPartnerApplication(supabase, {
        partner_kind: kind,
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        contact_number: contact.trim(),
        payload,
      });
      clearPartnerVerifiedEmail();
      toast.success("Application submitted! Log in to track verification status.");
      navigate("/partner/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Application failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Card className="p-6 md:p-8 shadow-elegant border-none">
          <div className="mb-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Partner application</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Apply as a partner</h1>
            <p className="mt-2 text-sm text-slate-600">
              Verify your email, then submit. Dashboard unlocks after admin verification.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
            {PARTNER_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const active = kind === tab.kind;
              return (
                <button
                  key={tab.kind}
                  type="button"
                  onClick={() => switchKind(tab.kind)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-bold transition sm:flex-row sm:justify-center sm:gap-2 sm:text-sm",
                    active ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <TabIcon className="size-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mb-6 flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon className="size-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{formTitle}</h2>
              <p className="text-sm text-slate-600">{PARTNER_KIND_LABELS[kind]} application</p>
            </div>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Email</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 font-bold"
                    disabled={otpSending || !email.trim()}
                    onClick={() => void handleSendOtp()}
                  >
                    {otpSending ? <Loader2 className="size-4 animate-spin" /> : "Send code"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <Label className="flex items-center gap-2">
                  <MailCheck className="size-4 text-primary" />
                  Email verification
                  {emailVerified ? (
                    <span className="text-xs font-bold text-emerald-600">Verified</span>
                  ) : null}
                </Label>
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                {devOtpHint ? (
                  <p className="text-xs text-amber-700">Dev OTP: {devOtpHint}</p>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="font-bold"
                  disabled={otpVerifying || otpCode.length !== 6}
                  onClick={() => void handleVerifyOtp()}
                >
                  {otpVerifying ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Verify email
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            {kind === "cyber_cafe" ? (
              <div className="space-y-1.5">
                <Label>Shop name</Label>
                <Input value={shopName} onChange={(e) => setShopName(e.target.value)} required />
              </div>
            ) : (
              <>
                {kind === "referral" ? (
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <Label className="text-sm font-black text-slate-900">What do you want to apply for?</Label>
                    <div className="grid gap-2">
                      {REFERRAL_APPLY_MODE_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-xl border p-3 transition",
                            referralApplyMode === option.value
                              ? "border-primary bg-primary/5"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                        >
                          <input
                            type="radio"
                            name="referral_apply_mode"
                            value={option.value}
                            checked={referralApplyMode === option.value}
                            onChange={() => setReferralApplyMode(option.value)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                            <span className="block text-xs text-slate-600">{option.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label>City (optional)</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Partner type</Label>
                  <Select value={referralType} onValueChange={setReferralType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REFERRAL_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <MultiSelectCheckboxGroup
                  label="Universities (optional)"
                  options={unis.map((u) => ({ id: u.name, name: u.name }))}
                  selectedValues={selectedUnis}
                  onChange={setSelectedUnis}
                  showAllOption={false}
                />
                <MultiSelectCheckboxGroup
                  label="Colleges (optional)"
                  options={collegeOptions.map((c) => ({ id: c.name, name: c.name }))}
                  selectedValues={selectedColleges}
                  onChange={setSelectedColleges}
                  showAllOption={false}
                  emptyLabel="Select universities first"
                />
              </>
            )}

            <Button type="submit" className="w-full font-black" disabled={loading || !emailVerified}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Submit application
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            Already applied? <Link to="/partner/dashboard" className="font-bold text-primary hover:underline">Check status</Link>
          </p>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
