import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, IndianRupee } from "lucide-react";
import {
  formatPaiseAsRupees,
  type ResolvedStudentServiceAccess,
} from "@/lib/studentServiceKeys";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  access: ResolvedStudentServiceAccess | null;
  onPay?: () => void;
};

export function StudentServiceLockDialog({ open, onOpenChange, access, onPay }: Props) {
  if (!access) return null;

  const { config, feeBreakdown } = access;
  const hasFee = feeBreakdown.totalPaise > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Lock className="size-5 text-amber-600" />
            {config.label} locked
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 leading-relaxed pt-1">
            {config.lockMessage}
          </DialogDescription>
        </DialogHeader>

        {hasFee ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
              <IndianRupee className="size-3" /> Fee breakdown
            </p>
            <div className="flex justify-between gap-3">
              <span className="text-slate-600">Service fee</span>
              <span className="font-bold tabular-nums">{formatPaiseAsRupees(feeBreakdown.basePaise)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-600">GST ({feeBreakdown.gstPercent}%)</span>
              <span className="font-bold tabular-nums">{formatPaiseAsRupees(feeBreakdown.gstPaise)}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
              <span className="font-black text-slate-900">Total payable</span>
              <span className="font-black text-primary tabular-nums">
                {formatPaiseAsRupees(feeBreakdown.totalPaise)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            No payment is configured for this service. Contact support if you believe this is an error.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {hasFee && onPay ? (
            <Button type="button" className="font-black" onClick={onPay}>
              Pay {formatPaiseAsRupees(feeBreakdown.totalPaise)}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
