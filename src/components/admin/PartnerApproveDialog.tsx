import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PARTNER_ACCESS_MODE_OPTIONS,
  resolvePartnerAccessMode,
  type PartnerAccessMode,
} from "@/lib/partnerAccessMode";
import { generateCouponCodeFromName } from "@/lib/referralCoupons";
import type { PartnerApplicationRow } from "@/lib/partnerApplications";
import type { ApprovePartnerOptions } from "@/lib/partnerApplicationAdmin";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: PartnerApplicationRow | null;
  busy?: boolean;
  onConfirm: (options: ApprovePartnerOptions) => void | Promise<void>;
};

export function PartnerApproveDialog({
  open,
  onOpenChange,
  application,
  busy = false,
  onConfirm,
}: Props) {
  const [accessMode, setAccessMode] = useState<PartnerAccessMode>("both");
  const [couponAmount, setCouponAmount] = useState("");
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    if (!open || !application) return;
    const mode = resolvePartnerAccessMode(application.partner_kind, application.payload || {});
    setAccessMode(mode);
    setCouponAmount(
      application.payload?.coupon_amount != null ? String(application.payload.coupon_amount) : ""
    );
    setCouponCode(
      String(application.payload?.coupon_code || generateCouponCodeFromName(application.full_name))
    );
  }, [open, application]);

  const showCouponFields = accessMode === "coupon_only" || accessMode === "both";

  const suggestedCode = useMemo(
    () => (application ? generateCouponCodeFromName(application.full_name) : ""),
    [application]
  );

  if (!application) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve partner access</DialogTitle>
          <DialogDescription>
            Choose what <span className="font-semibold">{application.full_name}</span> can use on the
            referral dashboard after approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-wide text-slate-500">
              Dashboard access
            </Label>
            <div className="grid gap-2">
              {PARTNER_ACCESS_MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex gap-2 rounded-lg border p-3 text-sm cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    checked={accessMode === option.value}
                    onChange={() => setAccessMode(option.value)}
                  />
                  <span>
                    <span className="font-bold block">{option.label}</span>
                    <span className="text-xs text-slate-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {showCouponFields ? (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-sm font-bold text-amber-900">Coupon setup</p>
              <div className="space-y-1.5">
                <Label>Coupon code</Label>
                <div className="flex gap-2">
                  <Input
                    className="font-mono text-sm uppercase"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  />
                  <Button type="button" variant="outline" onClick={() => setCouponCode(suggestedCode)}>
                    From name
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">Suggested: {suggestedCode}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Coupon amount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="e.g. 100"
                  value={couponAmount}
                  onChange={(e) => setCouponAmount(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void onConfirm({
                access_mode: accessMode,
                coupon_code: showCouponFields ? couponCode.trim() : null,
                coupon_amount: showCouponFields && couponAmount.trim() ? Number(couponAmount) : null,
                create_coupon: showCouponFields,
              })
            }
          >
            Approve &amp; unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
