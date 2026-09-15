import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CalendarDays, Loader2, ReceiptIndianRupee } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SalarySlipDialog } from "@/components/documents/SalarySlipDialog";
import { staffStatCardClass } from "@/components/staff/staffStyles";
import type { AdminStaffProfile } from "@/lib/staffProfile";
import {
  employeeInfoFromStaffProfile,
  formatSalaryMoney,
  formatSalaryPaidAt,
} from "@/lib/salarySlipFormat";
import {
  formatSalaryMonth,
  listMyPaidSalarySlips,
  type StaffSalarySlipRow,
} from "@/lib/staffSalary";

type Props = {
  isActive?: boolean;
  profile?: AdminStaffProfile | null;
};

export function StaffSalarySlipsPanel({ isActive = true, profile = null }: Props) {
  const [slips, setSlips] = useState<StaffSalarySlipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewSlip, setViewSlip] = useState<StaffSalarySlipRow | null>(null);

  const employeeInfo = useMemo(
    () => employeeInfoFromStaffProfile(profile, profile?.email),
    [profile]
  );

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
              Premium salary slips with company logo — available after admin marks your salary as paid.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Latest paid</p>
            <p className="text-2xl font-black text-emerald-800">{formatSalaryMoney(latestNet)}</p>
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
              <TableHead className="text-right">Slip</TableHead>
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
                  <TableCell className="font-semibold text-emerald-700">{formatSalaryMoney(slip.net_amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatSalaryPaidAt(slip.paid_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                    {slip.payment_reference || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setViewSlip(slip)}>
                      View slip
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      <SalarySlipDialog
        open={!!viewSlip}
        onOpenChange={(open) => !open && setViewSlip(null)}
        slip={viewSlip}
        employee={employeeInfo}
      />
    </div>
  );
}
