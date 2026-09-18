import { useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SalarySlipDocument } from "@/components/documents/SalarySlipDocument";
import { formatSalaryMonth, type StaffSalarySlipRow } from "@/lib/staffSalary";
import { downloadSalarySlipPdf } from "@/lib/salarySlipPdf";
import { salarySlipFileName, type SalarySlipEmployeeInfo } from "@/lib/salarySlipFormat";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slip: StaffSalarySlipRow | null;
  employee: SalarySlipEmployeeInfo | null;
};

export function SalarySlipDialog({ open, onOpenChange, slip, employee }: Props) {
  const slipRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!slipRef.current || !slip || !employee) return;
    setDownloading(true);
    try {
      await downloadSalarySlipPdf(
        slipRef.current,
        salarySlipFileName(slip, employee.fullName)
      );
      toast.success("Salary slip PDF downloaded");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not download PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!slipRef.current) return;
    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) {
      toast.error("Pop-up blocked — allow pop-ups to print");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Salary Slip</title>
      <style>
        body { margin: 0; padding: 16px; background: #f1f5f9; display: flex; justify-content: center; }
        @media print { body { padding: 0; background: #fff; } }
      </style></head><body>${slipRef.current.outerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[840px] max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Premium salary slip</DialogTitle>
          <DialogDescription>
            {slip && employee
              ? `${employee.fullName} — ${formatSalaryMonth(slip.salary_month)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-2 overflow-x-auto bg-slate-100/80 flex justify-center py-4">
          {slip && employee ? (
            <SalarySlipDocument ref={slipRef} slip={slip} employee={employee} />
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-white gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" variant="outline" onClick={handlePrint} disabled={!slip}>
            <Printer className="size-4 mr-2" />
            Print
          </Button>
          <Button type="button" onClick={() => void handleDownload()} disabled={downloading || !slip}>
            {downloading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Download className="size-4 mr-2" />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
