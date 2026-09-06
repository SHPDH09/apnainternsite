import { useEffect, useMemo, useState } from "react";
import { Loader2, Store, Share2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { REGISTRATION_PASSWORD_MIN_LENGTH } from "@/lib/registrationPassword";
import {
  PARTNER_KIND_LABELS,
  REFERRAL_APPLY_MODE_OPTIONS,
  type PartnerKind,
  type ReferralApplyMode,
} from "@/lib/partnerApplications";
import { REFERRAL_TYPE_OPTIONS } from "@/lib/referral";
import { fetchAllCollegesCatalog } from "@/lib/institutionCatalog";
import { MultiSelectCheckboxGroup } from "@/components/admin/MultiSelectCheckboxGroup";
import { collegesForUniversityNames } from "@/lib/classLinkTargeting";
import {
  adminCreatePartnerDirect,
  buildAdminPartnerRegistrationInput,
} from "@/lib/adminPartnerCreate";
import { generateCouponCodeFromName } from "@/lib/referralCoupons";
import { cn } from "@/lib/utils";

const PARTNER_TABS: Array<{ kind: PartnerKind; label: string; icon: typeof Store }> = [
  { kind: "referral", label: "Referral / Coupon", icon: Share2 },
  { kind: "cyber_cafe", label: "Cyber Cafe", icon: Store },
  { kind: "coupon", label: "Coupon only", icon: Ticket },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind?: PartnerKind;
  onCreated?: () => void;
};

export function AdminAddPartnerDialog({ open, onOpenChange, defaultKind = "referral", onCreated }: Props) {
  const [kind, setKind] = useState<PartnerKind>(defaultKind);
  const [saving, setSaving] = useState(false);
  const [unis, setUnis] = useState<Array<{ id: string; name: string }>>([]);
  const [colleges, setColleges] = useState<Array<{ id: string; name: string; university_id: string }>>([]);
  const [domains, setDomains] = useState<string[]>([]);

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
  const [domain, setDomain] = useState("");
  const [maxStudents, setMaxStudents] = useState("");
  const [studentEmails, setStudentEmails] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  const [couponAmount, setCouponAmount] = useState("");
  const [couponCode, setCouponCode] = useState("");

  const showCouponFields =
    kind === "coupon" ||
    (kind === "referral" && (referralApplyMode === "coupon_only" || referralApplyMode === "both"));

  useEffect(() => {
    if (open) setKind(defaultKind);
  }, [open, defaultKind]);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const collegeOptions = useMemo(
    () => collegesForUniversityNames(colleges, unis, selectedUnis),
    [colleges, unis, selectedUnis]
  );

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setContact("");
    setAddress("");
    setShopName("");
    setCity("");
    setReferralType("partner");
    setReferralApplyMode("referral_only");
    setSelectedUnis([]);
    setSelectedColleges([]);
    setDomain("");
    setMaxStudents("");
    setStudentEmails("");
    setValidFrom("");
    setValidTo("");
    setCouponAmount("");
    setCouponCode("");
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim() || !contact.trim() || !address.trim()) {
      toast.error("Name, email, phone, address, and password are required.");
      return;
    }
    if (password.trim().length < REGISTRATION_PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${REGISTRATION_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (kind === "cyber_cafe" && !shopName.trim()) {
      toast.error("Shop name is required for cyber cafe partners.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Admin session required");

      const input = buildAdminPartnerRegistrationInput({
        partner_kind: kind,
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        contact_number: contact.trim(),
        address: address.trim(),
        shop_name: shopName.trim(),
        city: city.trim(),
        referral_type: referralType,
        referral_apply_mode: referralApplyMode,
        universities: selectedUnis,
        colleges: selectedColleges,
        internship_domain: domain.trim() || null,
        max_students: maxStudents ? Number(maxStudents) : null,
        student_emails: studentEmails,
        valid_from: validFrom || null,
        valid_to: validTo || null,
        coupon_amount: couponAmount.trim() ? Number(couponAmount) : null,
        coupon_code: couponCode.trim() || (fullName.trim() ? generateCouponCodeFromName(fullName.trim()) : null),
        access_mode: kind === "coupon" ? "coupon_only" : referralApplyMode,
      });

      await adminCreatePartnerDirect(supabase, user.id, input);
      toast.success(`${PARTNER_KIND_LABELS[kind]} created and approved.`);
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add partner.");
    } finally {
      setSaving(false);
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
        <Label>Specific student emails (optional)</Label>
        <Textarea value={studentEmails} onChange={(e) => setStudentEmails(e.target.value)} rows={2} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Add partner</DialogTitle>
          <DialogDescription>
            Create and auto-approve a cyber cafe, referral, or coupon partner with the same fields as public registration.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
            {PARTNER_TABS.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.kind}
                  type="button"
                  onClick={() => setKind(tab.kind)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold sm:text-sm",
                    kind === tab.kind ? "bg-white text-primary shadow-sm" : "text-slate-600"
                  )}
                >
                  <TabIcon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <ScrollArea className="max-h-[min(60vh,520px)] px-6">
          <div className="space-y-4 pb-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Portal password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            {kind === "cyber_cafe" ? (
              <div className="space-y-1.5">
                <Label>Shop name</Label>
                <Input value={shopName} onChange={(e) => setShopName(e.target.value)} />
              </div>
            ) : (
              <>
                {kind === "referral" ? (
                  <div className="space-y-2 rounded-xl border p-3">
                    <Label className="text-xs font-black uppercase tracking-wide text-slate-500">Apply for</Label>
                    <div className="grid gap-2">
                      {REFERRAL_APPLY_MODE_OPTIONS.map((option) => (
                        <label key={option.value} className="flex gap-2 text-sm">
                          <input
                            type="radio"
                            checked={referralApplyMode === option.value}
                            onChange={() => setReferralApplyMode(option.value)}
                          />
                          <span>
                            <span className="font-bold">{option.label}</span>
                            <span className="block text-xs text-slate-500">{option.description}</span>
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
                {showCouponFields ? (
                  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                    <p className="text-sm font-bold text-amber-900">Coupon details</p>
                    <div className="space-y-1.5">
                      <Label>Coupon code</Label>
                      <Input
                        className="font-mono uppercase"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder={fullName.trim() ? generateCouponCodeFromName(fullName.trim()) : "CPN-NAME"}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Coupon amount (₹)</Label>
                      <Input type="number" min={0} value={couponAmount} onChange={(e) => setCouponAmount(e.target.value)} />
                    </div>
                    {couponFields}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className="font-black gap-2" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Add &amp; approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
