import { forwardRef } from "react";
import { formatSalaryMonth, SALARY_STATUS_LABELS, type StaffSalarySlipRow } from "@/lib/staffSalary";
import {
  formatSalaryMoney,
  formatSalaryPaidAt,
  maskAccountNumber,
  parseSalaryBreakdown,
  SALARY_SLIP_CAPTURE_WIDTH_PX,
  SALARY_SLIP_COMPANY,
  SALARY_SLIP_COMPANY_TAGLINE,
  SALARY_SLIP_FOOTER,
  SALARY_SLIP_LOGO,
  type SalarySlipEmployeeInfo,
} from "@/lib/salarySlipFormat";

type Props = {
  slip: StaffSalarySlipRow;
  employee: SalarySlipEmployeeInfo;
  className?: string;
};

const NAVY = "#0c2d5c";
const BLUE = "#1e6bb8";
const SKY = "#e8f4fd";
const ORANGE = "#f7941d";

const cell: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "13px",
  lineHeight: 1.45,
  borderBottom: "1px solid #e2e8f0",
};

const headCell: React.CSSProperties = {
  ...cell,
  fontWeight: 700,
  fontSize: "11px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: NAVY,
  background: SKY,
  borderBottom: `2px solid ${BLUE}`,
};

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: 600, color: "#0f172a", wordBreak: "break-word" }}>
        {value || "—"}
      </p>
    </div>
  );
}

export const SalarySlipDocument = forwardRef<HTMLDivElement, Props>(function SalarySlipDocument(
  { slip, employee, className },
  ref
) {
  const bd = parseSalaryBreakdown(slip);
  const earningsTotal =
    bd.basicSalary + bd.hra + bd.specialAllowance + bd.otherAllowances + bd.overtimeAmount;
  const deductionsTotal =
    bd.pfDeduction +
    bd.taxDeduction +
    bd.otherDeductions +
    slip.attendance_deduction +
    (slip.half_day_deduction || 0);

  const paymentModeLabel =
    bd.paymentMode === "upi" ? "UPI" : bd.paymentMode === "cash" ? "Cash" : "Bank Transfer";

  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: `${SALARY_SLIP_CAPTURE_WIDTH_PX}px`,
        maxWidth: `${SALARY_SLIP_CAPTURE_WIDTH_PX}px`,
        minWidth: `${SALARY_SLIP_CAPTURE_WIDTH_PX}px`,
        boxSizing: "border-box",
        background: "#ffffff",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        color: "#0f172a",
        border: `1px solid ${BLUE}33`,
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      {/* Header band */}
      <div
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,
          padding: "22px 28px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
          <img
            src={SALARY_SLIP_LOGO}
            alt={SALARY_SLIP_COMPANY}
            crossOrigin="anonymous"
            decoding="sync"
            style={{
              display: "block",
              height: "52px",
              width: "auto",
              maxWidth: "220px",
              objectFit: "contain",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
            }}
          />
        </div>
        <div style={{ textAlign: "right", color: "#ffffff", flexShrink: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            Salary Slip
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {formatSalaryMonth(slip.salary_month)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", opacity: 0.9 }}>
            {SALARY_STATUS_LABELS[slip.status]}
            {slip.paid_at ? ` · Paid ${formatSalaryPaidAt(slip.paid_at)}` : ""}
          </p>
        </div>
      </div>

      {/* Company tagline strip */}
      <div
        style={{
          background: SKY,
          borderBottom: `1px solid ${BLUE}33`,
          padding: "8px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: NAVY }}>{SALARY_SLIP_COMPANY_TAGLINE}</span>
        <span style={{ fontSize: "11px", color: "#475569" }}>
          Slip ID: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{slip.id.slice(0, 8).toUpperCase()}</span>
        </span>
      </div>

      <div style={{ padding: "22px 28px 26px" }}>
        {/* Employee details */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px 20px",
            padding: "16px 18px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <InfoBlock label="Employee name" value={employee.fullName} />
          <InfoBlock label="Employee ID" value={employee.employeeCode || slip.employee_id.slice(0, 8).toUpperCase()} />
          <InfoBlock label="Email" value={employee.email || "—"} />
          <InfoBlock label="Department / Role" value="Staff" />
          <InfoBlock label="Payment mode" value={paymentModeLabel} />
          <InfoBlock label="Pay period" value={formatSalaryMonth(slip.salary_month)} />
          {employee.bankName ? <InfoBlock label="Bank" value={employee.bankName} /> : null}
          {employee.accountNumber ? (
            <InfoBlock label="Account" value={maskAccountNumber(employee.accountNumber)} />
          ) : null}
          {employee.ifscCode ? <InfoBlock label="IFSC" value={employee.ifscCode} /> : null}
        </div>

        {/* Attendance summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "8px",
            marginBottom: "20px",
          }}
        >
          {[
            { label: "Present", value: slip.present_days, accent: "#059669" },
            { label: "Absent", value: slip.absent_days, accent: "#dc2626" },
            { label: "Paid leave", value: slip.leave_days, accent: BLUE },
            { label: "Unpaid leave", value: slip.unpaid_leave_days ?? 0, accent: "#b45309" },
            { label: "Half days", value: slip.half_days, accent: "#7c3aed" },
            { label: "Festivals", value: slip.festival_days ?? 0, accent: ORANGE },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                textAlign: "center",
                padding: "10px 6px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: item.accent }}>{item.value}</p>
              <p style={{ margin: "2px 0 0", fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Earnings & deductions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
            <thead>
              <tr>
                <th style={{ ...headCell, textAlign: "left" }} colSpan={2}>
                  Earnings
                </th>
              </tr>
              <tr>
                <th style={{ ...headCell, textAlign: "left", background: "#f1f5f9" }}>Component</th>
                <th style={{ ...headCell, textAlign: "right", background: "#f1f5f9", width: "120px" }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Basic salary", bd.basicSalary],
                ["HRA", bd.hra],
                ["Special allowance", bd.specialAllowance],
                ["Other allowances", bd.otherAllowances],
                bd.overtimeAmount > 0 ? [`Overtime (${bd.overtimeHours}h)`, bd.overtimeAmount] : null,
              ]
                .filter(Boolean)
                .map((row) => {
                  const [label, amount] = row as [string, number];
                  return (
                    <tr key={label}>
                      <td style={{ ...cell, color: "#334155" }}>{label}</td>
                      <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{formatSalaryMoney(amount).replace("₹", "")}</td>
                    </tr>
                  );
                })}
              <tr>
                <td style={{ ...cell, fontWeight: 700, color: NAVY, borderBottom: "none" }}>Gross earnings</td>
                <td style={{ ...cell, textAlign: "right", fontWeight: 800, color: "#059669", borderBottom: "none" }}>
                  {formatSalaryMoney(earningsTotal > 0 ? slip.gross_amount + bd.overtimeAmount : slip.gross_amount).replace("₹", "")}
                </td>
              </tr>
            </tbody>
          </table>

          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
            <thead>
              <tr>
                <th style={{ ...headCell, textAlign: "left" }} colSpan={2}>
                  Deductions
                </th>
              </tr>
              <tr>
                <th style={{ ...headCell, textAlign: "left", background: "#f1f5f9" }}>Component</th>
                <th style={{ ...headCell, textAlign: "right", background: "#f1f5f9", width: "120px" }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {[
                bd.pfDeduction > 0 ? ["PF", bd.pfDeduction] : null,
                bd.taxDeduction > 0 ? ["Tax (TDS)", bd.taxDeduction] : null,
                bd.otherDeductions > 0 ? ["Other deductions", bd.otherDeductions] : null,
                slip.attendance_deduction > 0 ? ["Attendance deduction", slip.attendance_deduction] : null,
                (slip.half_day_deduction || 0) > 0 ? ["Half-day deduction", slip.half_day_deduction] : null,
              ]
                .filter(Boolean)
                .map((row) => {
                  const [label, amount] = row as [string, number];
                  return (
                    <tr key={label}>
                      <td style={{ ...cell, color: "#334155" }}>{label}</td>
                      <td style={{ ...cell, textAlign: "right", fontWeight: 600, color: "#dc2626" }}>
                        {formatSalaryMoney(amount).replace("₹", "")}
                      </td>
                    </tr>
                  );
                })}
              {deductionsTotal <= 0 && (
                <tr>
                  <td style={{ ...cell, color: "#94a3b8", fontStyle: "italic" }} colSpan={2}>
                    No deductions this month
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ ...cell, fontWeight: 700, color: NAVY, borderBottom: "none" }}>Total deductions</td>
                <td style={{ ...cell, textAlign: "right", fontWeight: 800, color: "#dc2626", borderBottom: "none" }}>
                  {formatSalaryMoney(slip.total_deductions).replace("₹", "")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net pay banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderRadius: "10px",
            background: `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 55%, ${ORANGE} 140%)`,
            color: "#ffffff",
            marginBottom: "20px",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.9 }}>
              Net pay (in words)
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "13px", opacity: 0.95 }}>
              {paymentModeLabel}
              {slip.payment_reference ? ` · Ref: ${slip.payment_reference}` : ""}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.9 }}>
              Net amount payable
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "32px", fontWeight: 900, letterSpacing: "-0.02em" }}>
              {formatSalaryMoney(slip.net_amount)}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "24px",
            paddingTop: "8px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.6 }}>
            <p style={{ margin: 0, fontWeight: 700, color: NAVY, fontSize: "12px" }}>{SALARY_SLIP_COMPANY}</p>
            <p style={{ margin: "4px 0 0" }}>{SALARY_SLIP_FOOTER.website}</p>
            <p style={{ margin: 0 }}>{SALARY_SLIP_FOOTER.email}</p>
            <p style={{ margin: "8px 0 0", fontSize: "10px" }}>
              Per day rate: {formatSalaryMoney(bd.perDayRate)} · Working days/mo: {bd.workingDaysPerMonth}
            </p>
          </div>
          <div style={{ textAlign: "center", minWidth: "160px" }}>
            <div style={{ height: "48px", borderBottom: `2px solid ${NAVY}`, marginBottom: "6px" }} />
            <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: NAVY }}>Authorized Signatory</p>
            <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#94a3b8" }}>HR & Accounts · {SALARY_SLIP_COMPANY}</p>
          </div>
        </div>

        <p style={{ margin: "16px 0 0", fontSize: "9px", color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
          This is a computer-generated salary slip and does not require a physical signature unless mandated by policy.
          Generated on {formatSalaryPaidAt(slip.generated_at)}.
        </p>
      </div>
    </div>
  );
});
