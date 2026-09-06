import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Store, Share2, Ticket } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { REGISTRATION_PASSWORD_MIN_LENGTH } from "@/lib/registrationPassword";
import {
  PARTNER_KIND_LABELS,
  REFERRAL_APPLY_MODE_OPTIONS,
  submitPartnerApplication,
  type PartnerKind,
  type ReferralApplyMode,
} from "@/lib/partnerApplications";
import { REFERRAL_TYPE_OPTIONS } from "@/lib/referral";
import { fetchAllCollegesCatalog } from "@/lib/institutionCatalog";
import { MultiSelectCheckboxGroup } from "@/components/admin/MultiSelectCheckboxGroup";
import { collegesForUniversityNames } from "@/lib/classLinkTargeting";
import { cn } from "@/lib/utils";

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
  const [unis, setUnis] = useState<Array<{ id: string; name: string }>>([]);
  const [colleges, setColleges] = useState<Array<{ id: string; name: string; university_id: string }>>([]);
  const [domains, setDomains] = useState<string[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [shopName, setShopName] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [referralType, setReferralType] = useState("partner");
  const [referralApplyMode, setReferralApplyMode] = useState<ReferralApplyMode>("referral_only");
  const [selectedUnis, setSelectedUnis] = useState<string[]>([]);
  const [selectedColleges, setSelectedColleges] = useState<string[]>([]);
  const [domain, setDomain] = useState("");
  const [maxStudents, setMaxStudents] = useState("");
  const [studentEmails, setStudentEmails] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  const showCouponFields =
    kind === "coupon" ||
    (kind === "referral" && (referralApplyMode === "coupon_only" || referralApplyMode === "both"));

  const formTitle =
    kind === "referral"
      ? REFERRAL_APPLY_MODE_OPTIONS.find((o) => o.value === referralApplyMode)?.label ?? "Referral Partner"
      : PARTNER_KIND_LABELS[kind];

  useEffect(() => {
    void (async () => {
      const [{ data: uniData }, collegeRows, { data: domainRows }] = await Promise.all([
        supabase.from("universities").select("id, name").order("name"),
        fetchAllCollegesCatalog(supabase),
        supabase.from("internship_domains").select("name").order("name"),
      ]);
      setUnis((uniData || []) as Array<{ id: string; name: string }>);
      setColleges(collegeRows);
      setDomains((domainRows || []).map((d) => String((d as { name: string }).name)).filter(Boolean));
    })();
  }, []);

  const collegeOptions = useMemo(
    () => collegesForUniversityNames(colleges, unis, selectedUnis),
    [colleges, unis, selectedUnis]
  );

  const switchKind = (next: PartnerKind) => {
    setParams({ type: next }, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim() || !contact.trim()) {
      toast.error("Name, email, password, and contact are required.");
      return;
    }
    if (password.trim().length < REGISTRATION_PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${REGISTRATION_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    const payload: Record<string, unknown> = { city: city.trim() || null };

    if (kind === "cyber_cafe") {
      if (!shopName.trim() || !location.trim()) {
        toast.error("Shop name and location are required for cyber cafe partners.");
        return;
      }
      payload.shop_name = shopName.trim();
      payload.location = location.trim();
    } else {
      if (!selectedUnis.length) {
        toast.error("Select at least one university.");
        return;
      }
      payload.universities = selectedUnis;
      payload.colleges = selectedColleges;
      payload.referral_type = referralType;
      payload.university_name = selectedUnis[0] || null;
      payload.college_name = selectedColleges[0] || null;
    }

    if (kind === "referral") {
      payload.referral_apply_mode = referralApplyMode;
    }

    if (showCouponFields) {
      payload.internship_domain = domain.trim() || null;
      payload.max_students = maxStudents ? Number(maxStudents) : null;
      payload.student_emails = studentEmails;
      payload.valid_from = validFrom || null;
      payload.valid_to = validTo || null;
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
      toast.success("Application submitted! Log in to track verification status.");
      navigate("/partner/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Application failed.");
    } finally {
      setLoading(false);
    }
  };

  const couponFields = (
    <>
      <div className="space-y-1.5">
        <Label>Internship domain</Label>
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
          <SelectContent>
            {domains.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Max students</Label>
        <Input type="number" min={1} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Specific student emails (optional, comma-separated)</Label>
        <Textarea value={studentEmails} onChange={(e) => setStudentEmails(e.target.value)} rows={3} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Valid from</Label>
          <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Valid to</Label>
          <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Card className="p-6 md:p-8 shadow-elegant border-none">
          <div className="mb-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Partner application</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Apply as a partner</h1>
            <p className="mt-2 text-sm text-slate-600">
              Choose cyber cafe, referral, or coupon. Dashboard unlocks after admin verification.
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
                    active
                      ? "bg-white text-primary shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
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
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Contact number</Label>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            {kind === "cyber_cafe" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Shop name</Label>
                  <Input value={shopName} onChange={(e) => setShopName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} required />
                </div>
              </>
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
                  <Label>City</Label>
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
                  label="Universities"
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

                {showCouponFields ? (
                  <div className="space-y-4 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4">
                    <p className="text-sm font-bold text-amber-900">Coupon details</p>
                    {couponFields}
                  </div>
                ) : null}
              </>
            )}

            <Button type="submit" className="w-full font-black" disabled={loading}>
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
