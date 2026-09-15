import { useCallback, useEffect, useState } from "react";
import { Banknote, CalendarDays, Loader2, ReceiptIndianRupee } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { staffStatCardClass } from "@/components/staff/staffStyles";
import {
  formatSalaryMonth,
  listMyPaidSalarySlips,
  SALARY_STATUS_LABELS,
  type StaffSalarySlipRow,
} from "@/lib/staffSalary";

type Props = {
  isActive?: boolean;
};

function money(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPaidAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function StaffSalarySlipsPanel({ isActive = true }: Props) {
  const [slips, setSlips] = useState<StaffSalarySlipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownSlip, setBreakdownSlip] = useState<StaffSalarySlipRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSlips(await listMyPaidSalarySlips());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load salary slips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) void load();
  }, [isActive, load]);

  const latestNet = slips[0]?.net_amount ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <Card className={`${staffStatCardClass} p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Salary</p>
            <h2 className="text-xl font-bold text-slate-900 mt-1">My salary slips</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Paid salary slips appear here after admin marks your salary as paid. Generated or
              pending slips are not shown.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Latest paid</p>
            <p className="text-2xl font-black text-emerald-800">{money(Number(latestNet))}</p>
          </div>
        </div>
      </Card>

      <Card className={`${staffStatCardClass} overflow-hidden`}>
        <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2">
          <ReceiptIndianRupee className="size-5 text-emerald-600" />
          <h3 className="font-semibold text-slate-800">Paid slips</h3>
          <Badge variant="outline" className="ml-auto bg-emerald-50 text-emerald-700 border-emerald-200">
            {slips.length} record{slips.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Net pay</TableHead>
              <TableHead>Paid on</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <Loader2 className="size-5 animate-spin inline text-slate-400" />
                </TableCell>
              </TableRow>
            )}
            {!loading && slips.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  <Banknote className="size-8 mx-auto mb-2 opacity-40" />
                  No paid salary slips yet. They will appear here once admin marks your salary as paid.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              slips.map((slip) => (
                <TableRow key={slip.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <CalendarDays className="size-4 text-slate-400" />
                      {formatSalaryMonth(slip.salary_month)}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-emerald-700">{money(slip.net_amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatPaidAt(slip.paid_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                    {slip.payment_reference || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setBreakdownSlip(slip)}>
                      View slip
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!breakdownSlip} onOpenChange={(open) => !open && setBreakdownSlip(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salary slip</DialogTitle>
            <DialogDescription>
              {breakdownSlip
                ? `${formatSalaryMonth(breakdownSlip.salary_month)} — ${SALARY_STATUS_LABELS.paid}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {breakdownSlip && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Gross</span>
                <span className="text-right font-medium">{money(breakdownSlip.gross_amount)}</span>
                <span className="text-muted-foreground">Present days</span>
                <span className="text-right">{breakdownSlip.present_days}</span>
                <span className="text-muted-foreground">Absent</span>
                <span className="text-right">{breakdownSlip.absent_days}</span>
                <span className="text-muted-foreground">Festival holidays</span>
                <span className="text-right">{breakdownSlip.festival_days ?? 0}</span>
                <span className="text-muted-foreground">Paid leave</span>
                <span className="text-right">{breakdownSlip.leave_days}</span>
                <span className="text-muted-foreground">Unpaid leave</span>
                <span className="text-right">{breakdownSlip.unpaid_leave_days ?? 0}</span>
                <span className="text-muted-foreground">Half days</span>
                <span className="text-right">{breakdownSlip.half_days}</span>
                <span className="text-muted-foreground">Attendance deduction</span>
                <span className="text-right text-red-600">-{money(breakdownSlip.attendance_deduction)}</span>
                <span className="text-muted-foreground">Total deductions</span>
                <span className="text-right text-red-600">-{money(breakdownSlip.total_deductions)}</span>
                <span className="text-muted-foreground">Overtime ({breakdownSlip.overtime_hours ?? 0}h)</span>
                <span className="text-right text-emerald-700">+{money(breakdownSlip.overtime_amount || 0)}</span>
                <span className="text-muted-foreground font-semibold">Net pay</span>
                <span className="text-right font-bold text-emerald-700">{money(breakdownSlip.net_amount)}</span>
              </div>
              {breakdownSlip.payment_reference ? (
                <p className="text-xs text-muted-foreground border-t pt-3">
                  Payment reference: <span className="font-medium">{breakdownSlip.payment_reference}</span>
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
