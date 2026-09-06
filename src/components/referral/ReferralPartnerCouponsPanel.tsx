import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Loader2, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import {
  buildRegisterUrlWithCoupon,
  createReferralCouponFromPayload,
  fetchCouponsForPartner,
  type ReferralCouponRow,
} from "@/lib/referralCoupons";
import { getPublicRegisterUrlWithRef } from "@/lib/referral";

type Props = {
  partnerId: string;
  referralCode: string;
  isActive?: boolean;
};

export function ReferralPartnerCouponsPanel({ partnerId, referralCode, isActive = true }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReferralCouponRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [university, setUniversity] = useState("");
  const [college, setCollege] = useState("");
  const [domain, setDomain] = useState("");
  const [maxStudents, setMaxStudents] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchCouponsForPartner(supabase, partnerId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load coupons.");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (!isActive) return;
    void reload();
  }, [isActive, reload]);

  const createCoupon = async () => {
    setSaving(true);
    try {
      await createReferralCouponFromPayload(supabase, {
        referralPartnerId: partnerId,
        payload: {
          university_name: university.trim(),
          college_name: college.trim(),
          internship_domain: domain.trim(),
          max_students: maxStudents ? Number(maxStudents) : null,
          valid_from: validFrom || null,
          valid_to: validTo || null,
        },
      });
      toast.success("Coupon created.");
      setUniversity("");
      setCollege("");
      setDomain("");
      setMaxStudents("");
      setValidFrom("");
      setValidTo("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (couponCode: string) => {
    const url = buildRegisterUrlWithCoupon(couponCode, referralCode);
    await navigator.clipboard.writeText(url);
    toast.success("Coupon registration link copied.");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-6">
        <Loader2 className="size-4 animate-spin" /> Loading coupons…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 border-none shadow-elegant space-y-4">
        <div className="flex items-center gap-2">
          <Ticket className="size-5 text-primary" />
          <h3 className="font-black text-slate-900">Coupons</h3>
        </div>
        <p className="text-sm text-slate-600">
          Create scoped coupons for universities, colleges, and domains. Track clicks and redemptions alongside your referral link (
          <button type="button" className="text-primary font-bold underline" onClick={() => void navigator.clipboard.writeText(getPublicRegisterUrlWithRef(referralCode))}>
            copy referral link
          </button>
          ).
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">University</Label>
            <Input value={university} onChange={(e) => setUniversity(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">College</Label>
            <Input value={college} onChange={(e) => setCollege(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Domain</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max students</Label>
            <Input type="number" min={1} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valid from</Label>
            <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valid to</Label>
            <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className="h-9" />
          </div>
        </div>
        <Button className="font-black gap-2" disabled={saving} onClick={() => void createCoupon()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Create coupon
        </Button>
      </Card>

      <Card className="overflow-hidden border-none shadow-elegant">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Validity</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead className="text-right">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs font-bold">{row.coupon_code}</TableCell>
                <TableCell className="text-xs">
                  <p>{row.university_name || "Any university"}</p>
                  <p className="text-slate-500">{row.college_name || "Any college"} · {row.internship_domain || "Any domain"}</p>
                </TableCell>
                <TableCell className="text-xs">
                  {row.valid_from ? new Date(row.valid_from).toLocaleDateString() : "—"} →{" "}
                  {row.valid_to ? new Date(row.valid_to).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="secondary">{row.click_count} clicks</Badge>
                    <Badge variant="outline">{row.redemption_count} regs</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => void copyLink(row.coupon_code)}>
                    <Copy className="size-3" /> Copy
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-6">
                  No coupons yet. Create one above or apply from the homepage as a coupon partner.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
