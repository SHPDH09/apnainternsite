import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calculator,
  CheckCircle2,
  IndianRupee,
  Loader2,
  Settings2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminCardClass } from "@/components/admin/ui/adminStyles";
import type { AdminStaffProfile } from "@/lib/staffProfile";
import {
  calcGrossFromSetup,
  formatSalaryMonth,
  generateStaffSalary,
  listStaffSalarySetups,
  listStaffSalarySlips,
  markStaffSalaryPaid,
  PAYMENT_MODE_LABELS,
  SALARY_STATUS_LABELS,
  upsertStaffSalarySetup,
  type StaffSalaryPaymentMode,
  type StaffSalarySetupRow,
  type StaffSalarySlipRow,
} from "@/lib/staffSalary";
import { cn } from "@/lib/utils";

type Props = {
  staff: AdminStaffProfile[];
  currentUserId: string | null;
  isActive?: boolean;
};

const STATUS_BADGE: Record<string, string> = {
  generated: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function money(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function StaffSalaryAccountPanel({ staff, currentUserId, isActive = true }: Props) {
  const [accountTab, setAccountTab] = useState("setup");
  const [loading, setLoading] = useState(false);
  const [setups, setSetups] = useState<StaffSalarySetupRow[]>([]);
  const [slips, setSlips] = useState<StaffSalarySlipRow[]>([]);
  const [salaryMonth, setSalaryMonth] = useState(currentYearMonth());
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupTarget, setSetupTarget] = useState<AdminStaffProfile | null>(null);
  const [payRefOpen, setPayRefOpen] = useState(false);
  const [payRefSlip, setPayRefSlip] = useState<StaffSalarySlipRow | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    basic_salary: "",
    hra: "",
    special_allowance: "",
    other_allowances: "",
    pf_deduction: "",
    tax_deduction: "",
    other_deductions: "",
    working_days_per_month: "26",
    payment_mode: "bank_transfer" as StaffSalaryPaymentMode,
    payment_notes: "",
  });

  const setupByEmployee = useMemo(() => {
    const map = new Map<string, StaffSalarySetupRow>();
    setups.forEach((s) => map.set(s.employee_id, s));
    return map;
  }, [setups]);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => map.set(s.id, s.full_name || s.email));
    return map;
  }, [staff]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [setupRows, slipRows] = await Promise.all([
        listStaffSalarySetups(),
        listStaffSalarySlips({ salaryMonth }),
      ]);
      setSetups(setupRows);
      setSlips(slipRows);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load salary data");
    } finally {
      setLoading(false);
    }
  }, [salaryMonth]);

  useEffect(() => {
    if (isActive) void load();
  }, [isActive, load]);

  const openSetup = (member: AdminStaffProfile) => {
    const existing = setupByEmployee.get(member.id);
    setSetupTarget(member);
    setForm({
      basic_salary: existing ? String(existing.basic_salary) : "",
      hra: existing ? String(existing.hra) : "",
      special_allowance: existing ? String(existing.special_allowance) : "",
      other_allowances: existing ? String(existing.other_allowances) : "",
      pf_deduction: existing ? String(existing.pf_deduction) : "",
      tax_deduction: existing ? String(existing.tax_deduction) : "",
      other_deductions: existing ? String(existing.other_deductions) : "",
      working_days_per_month: existing ? String(existing.working_days_per_month) : "26",
      payment_mode: existing?.payment_mode || "bank_transfer",
      payment_notes: existing?.payment_notes || "",
    });
    setSetupOpen(true);
  };

  const saveSetup = async () => {
    if (!setupTarget) return;
    const basic = Number(form.basic_salary);
    if (!basic || basic <= 0) {
      toast.error("Basic salary is required");
      return;
    }
    setBusy(true);
    try {
      await upsertStaffSalarySetup({
        employeeId: setupTarget.id,
        basicSalary: basic,
        hra: Number(form.hra || 0),
        specialAllowance: Number(form.special_allowance || 0),
        otherAllowances: Number(form.other_allowances || 0),
        pfDeduction: Number(form.pf_deduction || 0),
        taxDeduction: Number(form.tax_deduction || 0),
        otherDeductions: Number(form.other_deductions || 0),
        workingDaysPerMonth: Number(form.working_days_per_month || 26),
        paymentMode: form.payment_mode,
        paymentNotes: form.payment_notes,
        updatedBy: currentUserId,
      });
      toast.success("Payment setup saved");
      setSetupOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save setup");
    } finally {
      setBusy(false);
    }
  };

  const runGenerate = async (employeeId: string) => {
    setGeneratingId(employeeId);
    try {
      await generateStaffSalary(employeeId, salaryMonth);
      toast.success("Salary generated");
      await load();
      setAccountTab("status");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGeneratingId(null);
    }
  };

  const generateAllReady = async () => {
    const ready = staff.filter(
      (s) => setupByEmployee.get(s.id)?.is_active && !slips.some((sl) => sl.employee_id === s.id)
    );
    if (!ready.length) {
      toast.message("No staff pending generation (setup required or already generated)");
      return;
    }
    setBusy(true);
    let ok = 0;
    for (const member of ready) {
      try {
        await generateStaffSalary(member.id, salaryMonth);
        ok += 1;
      } catch {
        /* continue */
      }
    }
    setBusy(false);
    toast.success(`Generated salary for ${ok} staff member(s)`);
    await load();
    setAccountTab("status");
  };

  const confirmPaid = async () => {
    if (!payRefSlip) return;
    setBusy(true);
    try {
      await markStaffSalaryPaid(payRefSlip.id, paymentReference);
      toast.success("Marked as paid");
      setPayRefOpen(false);
      setPaymentReference("");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  };

  const previewGross = calcGrossFromSetup({
    basic_salary: Number(form.basic_salary || 0),
    hra: Number(form.hra || 0),
    special_allowance: Number(form.special_allowance || 0),
    other_allowances: Number(form.other_allowances || 0),
  });

  if (!isActive) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Wallet className="size-5 text-emerald-600" /> Account — Staff Salary
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Step 1: Payment setup → Step 2: Generate salary → Step 3: Track payout status
        </p>
      </div>

      <Tabs value={accountTab} onValueChange={setAccountTab}>
        <TabsList className="bg-slate-100 flex-wrap h-auto gap-1">
          <TabsTrigger value="setup" className="gap-1.5">
            <Settings2 className="size-3.5" /> 1. Payment Setup
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-1.5">
            <Calculator className="size-3.5" /> 2. Generate Salary
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-1.5">
            <CheckCircle2 className="size-3.5" /> 3. Salary Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4">
          <Card className={cn(adminCardClass, "overflow-hidden")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Monthly gross</TableHead>
                  <TableHead>Payment mode</TableHead>
                  <TableHead>Setup</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center">
                      <Loader2 className="size-5 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && staff.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No staff members
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  staff.map((member) => {
                    const setup = setupByEmployee.get(member.id);
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <p className="font-semibold text-sm">{member.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </TableCell>
                        <TableCell>{setup ? money(calcGrossFromSetup(setup)) : "—"}</TableCell>
                        <TableCell>
                          {setup ? PAYMENT_MODE_LABELS[setup.payment_mode] : "—"}
                        </TableCell>
                        <TableCell>
                          {setup ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              Configured
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openSetup(member)}>
                            {setup ? "Edit setup" : "Setup payment"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="mt-4 space-y-4">
          <Card className={cn(adminCardClass, "p-4 flex flex-wrap items-end gap-4")}>
            <div className="space-y-1.5">
              <Label>Salary month</Label>
              <Input
                type="month"
                value={salaryMonth}
                onChange={(e) => setSalaryMonth(e.target.value)}
                className="w-[11rem]"
              />
            </div>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={busy || loading}
              onClick={() => void generateAllReady()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <IndianRupee className="size-4" />}
              Generate all (with setup)
            </Button>
          </Card>

          <Card className={cn(adminCardClass, "overflow-hidden")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Setup</TableHead>
                  <TableHead>This month</TableHead>
                  <TableHead className="text-right">Generate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => {
                  const setup = setupByEmployee.get(member.id);
                  const slip = slips.find((s) => s.employee_id === member.id);
                  const canGenerate = !!setup && !slip;
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium text-sm">{member.full_name || member.email}</TableCell>
                      <TableCell>
                        {setup ? money(calcGrossFromSetup(setup)) : (
                          <span className="text-amber-600 text-xs">Setup required</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {slip ? (
                          <Badge variant="outline" className={STATUS_BADGE[slip.status]}>
                            {SALARY_STATUS_LABELS[slip.status]} · {money(slip.net_amount)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not generated</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          disabled={!canGenerate || generatingId === member.id}
                          onClick={() => void runGenerate(member.id)}
                        >
                          {generatingId === member.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Generate"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="mt-4 space-y-4">
          <Card className={cn(adminCardClass, "p-4 flex flex-wrap items-end gap-4")}>
            <div className="space-y-1.5">
              <Label>Filter month</Label>
              <Input
                type="month"
                value={salaryMonth}
                onChange={(e) => setSalaryMonth(e.target.value)}
                className="w-[11rem]"
              />
            </div>
            <Button variant="outline" disabled={loading} onClick={() => void load()}>
              Refresh
            </Button>
          </Card>

          <Card className={cn(adminCardClass, "overflow-hidden")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <Loader2 className="size-5 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && slips.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No salary records for {formatSalaryMonth(`${salaryMonth}-01`)}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  slips.map((slip) => (
                    <TableRow key={slip.id}>
                      <TableCell className="font-medium text-sm">
                        {staffNameById.get(slip.employee_id) || slip.employee_id}
                      </TableCell>
                      <TableCell>{formatSalaryMonth(slip.salary_month)}</TableCell>
                      <TableCell>{slip.present_days}</TableCell>
                      <TableCell>{slip.absent_days}</TableCell>
                      <TableCell>{money(slip.gross_amount)}</TableCell>
                      <TableCell className="font-semibold">{money(slip.net_amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE[slip.status]}>
                          {SALARY_STATUS_LABELS[slip.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {slip.status === "generated" ? (
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setPayRefSlip(slip);
                              setPaymentReference("");
                              setPayRefOpen(true);
                            }}
                          >
                            <Banknote className="size-3.5" />
                            Mark paid
                          </Button>
                        ) : slip.payment_reference ? (
                          <span className="text-xs text-muted-foreground">{slip.payment_reference}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment setup — {setupTarget?.full_name || setupTarget?.email}</DialogTitle>
            <DialogDescription>
              Configure monthly salary components and payment mode before generating salary.
            </DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Basic salary *</Label>
              <Input
                type="number"
                min={0}
                value={form.basic_salary}
                onChange={(e) => setForm((p) => ({ ...p, basic_salary: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>HRA</Label>
              <Input
                type="number"
                min={0}
                value={form.hra}
                onChange={(e) => setForm((p) => ({ ...p, hra: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Special allowance</Label>
              <Input
                type="number"
                min={0}
                value={form.special_allowance}
                onChange={(e) => setForm((p) => ({ ...p, special_allowance: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Other allowances</Label>
              <Input
                type="number"
                min={0}
                value={form.other_allowances}
                onChange={(e) => setForm((p) => ({ ...p, other_allowances: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>PF deduction</Label>
              <Input
                type="number"
                min={0}
                value={form.pf_deduction}
                onChange={(e) => setForm((p) => ({ ...p, pf_deduction: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tax deduction</Label>
              <Input
                type="number"
                min={0}
                value={form.tax_deduction}
                onChange={(e) => setForm((p) => ({ ...p, tax_deduction: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Other deductions</Label>
              <Input
                type="number"
                min={0}
                value={form.other_deductions}
                onChange={(e) => setForm((p) => ({ ...p, other_deductions: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Working days / month</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.working_days_per_month}
                onChange={(e) => setForm((p) => ({ ...p, working_days_per_month: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Payment mode</Label>
              <Select
                value={form.payment_mode}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, payment_mode: v as StaffSalaryPaymentMode }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_MODE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.payment_notes}
                onChange={(e) => setForm((p) => ({ ...p, payment_notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="sm:col-span-2 rounded-lg bg-slate-50 border p-3 text-sm">
              <span className="text-muted-foreground">Monthly gross preview: </span>
              <span className="font-bold text-emerald-700">{money(previewGross)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void saveSetup()}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              Save payment setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payRefOpen} onOpenChange={setPayRefOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark salary as paid</DialogTitle>
            <DialogDescription>
              {payRefSlip
                ? `${staffNameById.get(payRefSlip.employee_id)} — ${money(payRefSlip.net_amount)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Payment reference (UTR / txn id)</Label>
            <Input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Optional reference number"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayRefOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void confirmPaid()}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              Confirm paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
