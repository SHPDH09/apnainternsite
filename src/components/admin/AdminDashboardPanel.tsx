import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Calendar,
  Download,
  IndianRupee,
  Loader2,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AdminContentCard,
  AdminStatCard,
} from "@/components/admin/ui";
import { adminHeroClass } from "@/components/admin/ui/adminStyles";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type PaymentRow = {
  created_at: string;
  amount_paise: number;
};

type DatePreset = "today" | "7d" | "mtd" | "custom";

type AdminDashboardPanelProps = {
  payments: PaymentRow[];
  cancelledPayments: PaymentRow[];
  studentTotalCount: number;
  visitorCount: number;
  uniqueVisitorCount: number;
  isPaymentsLoading?: boolean;
  onExportCsv: () => void;
  onNavigateTab?: (tab: string) => void;
};

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "mtd", label: "This Month" },
  { id: "custom", label: "Custom" },
];

function presetRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "today") {
    const t = fmt(now);
    return { start: t, end: t };
  }
  if (preset === "7d") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { start: fmt(s), end: fmt(now) };
  }
  if (preset === "mtd") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: fmt(s), end: fmt(now) };
  }
  return { start: "", end: "" };
}

function getDashboardStats(payments: PaymentRow[], cancelledPayments: PaymentRow[]) {
  const today = new Date().toLocaleDateString();
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();

  const todayRevenue = payments
    .filter((p) => new Date(p.created_at).toLocaleDateString() === today)
    .reduce((acc, curr) => acc + curr.amount_paise / 100, 0);
  const yesterdayRevenue = payments
    .filter((p) => new Date(p.created_at).toLocaleDateString() === yesterday)
    .reduce((acc, curr) => acc + curr.amount_paise / 100, 0);

  const todayEnrolledCount = payments.filter(
    (p) => new Date(p.created_at).toLocaleDateString() === today
  ).length;
  const todayLeadsCount = cancelledPayments.filter(
    (p) => new Date(p.created_at).toLocaleDateString() === today
  ).length;

  const growth =
    yesterdayRevenue === 0 ? (todayRevenue > 0 ? 100 : 0) : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;

  const totalRevenue = payments.reduce((acc, p) => acc + p.amount_paise / 100, 0);
  const avgOrderValue = payments.length ? totalRevenue / payments.length : 0;

  return { todayRevenue, growth, todayEnrolledCount, todayLeadsCount, avgOrderValue, totalRevenue };
}

function filterRevenueByDate(
  payments: PaymentRow[],
  dashStartDate: string,
  dashEndDate: string
) {
  let filtered = payments;
  if (dashStartDate) {
    filtered = filtered.filter((p) => p.created_at >= `${dashStartDate}T00:00:00`);
  }
  if (dashEndDate) {
    filtered = filtered.filter((p) => p.created_at <= `${dashEndDate}T23:59:59`);
  }

  const daily: Record<string, number> = {};
  filtered.forEach((p) => {
    const date = new Date(p.created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    daily[date] = (daily[date] || 0) + p.amount_paise / 100;
  });
  return Object.entries(daily).map(([date, amount]) => ({ date, amount }));
}

function paymentsByDayOfWeek(payments: PaymentRow[]): { day: string; count: number }[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = new Array(7).fill(0);
  payments.forEach((p) => {
    counts[new Date(p.created_at).getDay()] += 1;
  });
  return days.map((day, i) => ({ day, count: counts[i] }));
}

export function AdminDashboardPanel({
  payments,
  cancelledPayments,
  studentTotalCount,
  visitorCount,
  uniqueVisitorCount,
  isPaymentsLoading,
  onExportCsv,
  onNavigateTab,
}: AdminDashboardPanelProps) {
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [dashStartDate, setDashStartDate] = useState(() => presetRange("7d").start);
  const [dashEndDate, setDashEndDate] = useState(() => presetRange("7d").end);

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    if (p === "custom") return;
    const { start, end } = presetRange(p);
    setDashStartDate(start);
    setDashEndDate(end);
  };

  const stats = useMemo(
    () => getDashboardStats(payments, cancelledPayments),
    [payments, cancelledPayments]
  );

  const filteredPayments = useMemo(() => {
    let rows = payments;
    if (dashStartDate) rows = rows.filter((p) => p.created_at >= `${dashStartDate}T00:00:00`);
    if (dashEndDate) rows = rows.filter((p) => p.created_at <= `${dashEndDate}T23:59:59`);
    return rows;
  }, [payments, dashStartDate, dashEndDate]);

  const chartData = useMemo(
    () => filterRevenueByDate(payments, dashStartDate, dashEndDate),
    [payments, dashStartDate, dashEndDate]
  );

  const weekdayData = useMemo(() => paymentsByDayOfWeek(filteredPayments), [filteredPayments]);

  const rangeRevenue = filteredPayments.reduce((a, p) => a + p.amount_paise / 100, 0);

  return (
    <div className="space-y-8">
      {/* Branded hero */}
      <section className={cn(adminHeroClass, "portal-dash-animate-in")}>
        <div className="absolute bottom-0 left-0 top-0 w-1 student-dash-hero-accent rounded-l-xl" aria-hidden />

        <div className="relative flex flex-col gap-6 pl-2 lg:flex-row lg:items-end lg:justify-between lg:pl-3">
          <div className="space-y-3">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-600">
              {BRAND_NAME} · Admin console
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                Operations dashboard
              </h1>
              <p className="mt-1 max-w-lg text-sm text-slate-500">
                Enrollment, revenue, leads, and site traffic — all in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500">Range revenue</p>
                <p className="text-xl font-semibold text-slate-900">₹{rangeRevenue.toLocaleString()}</p>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <p className="text-xs font-medium text-slate-500">Payments in range</p>
                <p className="text-xl font-semibold text-[#5AA3E6]">{filteredPayments.length}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant={preset === p.id ? "default" : "outline"}
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs font-medium",
                    preset === p.id
                      ? "bg-slate-800 text-white hover:bg-slate-900"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2">
              <Calendar className="ml-1 size-4 shrink-0 text-slate-500" />
              <Input
                type="date"
                value={dashStartDate}
                onChange={(e) => {
                  setPreset("custom");
                  setDashStartDate(e.target.value);
                }}
                className="h-8 w-[9rem] border-slate-200 bg-white text-xs"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date"
                value={dashEndDate}
                onChange={(e) => {
                  setPreset("custom");
                  setDashEndDate(e.target.value);
                }}
                className="h-8 w-[9rem] border-slate-200 bg-white text-xs"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 bg-slate-800 text-white hover:bg-slate-900"
                onClick={onExportCsv}
              >
                <Download className="size-3.5" />
                Export
              </Button>
              {isPaymentsLoading ? (
                <Loader2 className="size-4 animate-spin text-slate-400" />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* KPI metrics */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Key metrics</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Enrolled students"
            value={studentTotalCount.toLocaleString()}
            hint="Active internship period"
            icon={Users}
            accent="brand"
          />
          <AdminStatCard
            label="Today's revenue"
            value={`₹${stats.todayRevenue.toLocaleString()}`}
            icon={IndianRupee}
            trend={{ value: stats.growth, label: "vs yesterday" }}
            loading={isPaymentsLoading && payments.length === 0}
            accent="emerald"
          />
          <AdminStatCard
            label="New enrollments"
            value={stats.todayEnrolledCount.toLocaleString()}
            hint="Completed payments today"
            icon={TrendingUp}
            accent="violet"
          />
          <AdminStatCard
            label="Abandoned carts"
            value={cancelledPayments.length.toLocaleString()}
            hint={`${stats.todayLeadsCount} today · follow-up needed`}
            icon={ShoppingCart}
            accent="amber"
          />
        </div>
      </section>

      {/* Analytics */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Analytics</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <AdminContentCard
            className="lg:col-span-2"
            title="Revenue trend"
            description="Payment volume for the selected date range"
            action={
              isPaymentsLoading && payments.length === 0 ? (
                <Loader2 className="size-4 animate-spin text-slate-400" aria-label="Loading" />
              ) : null
            }
          >
            {chartData.length === 0 ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 text-center">
                <IndianRupee className="size-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No payments in this date range</p>
                <p className="text-xs text-slate-400">Try a wider date range or check Payments tab</p>
              </div>
            ) : (
              <ChartContainer
                config={{ amount: { label: "Revenue (₹)", color: "#5AA3E6" } }}
                className="h-[280px] w-full"
              >
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminBrandRevFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5AA3E6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#5AA3E6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-100" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v) => `₹${v}`}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span className="font-bold">₹{Number(value).toLocaleString()}</span>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#2B7CD3"
                    strokeWidth={2.5}
                    fill="url(#adminBrandRevFill)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </AdminContentCard>

          <AdminContentCard
            title="Enrollments by day"
            description="Weekday distribution"
          >
            <ChartContainer
              config={{ count: { label: "Payments", color: "#2B7CD3" } }}
              className="h-[280px] w-full"
            >
              <BarChart data={weekdayData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-100" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#5AA3E6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </AdminContentCard>
        </div>
      </section>

      {/* Traffic + quick actions */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Insights & actions</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <AdminContentCard variant="dark" title="Site traffic" description="Public homepage analytics">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Page views</p>
                <p className="mt-1 text-3xl font-bold text-white">{visitorCount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unique visitors</p>
                <p className="mt-1 text-3xl font-bold text-[#5AA3E6]">{uniqueVisitorCount.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
              <Activity className="size-4 text-[#F7941D]" />
              Avg order value: <span className="font-bold text-white">₹{stats.avgOrderValue.toFixed(0)}</span>
            </div>
          </AdminContentCard>

          <AdminContentCard
            className="lg:col-span-2"
            title="Quick actions"
            description="Jump to frequently used modules"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { tab: "students", label: "Student directory", icon: Users, color: "hover:border-[#5AA3E6]/40 hover:bg-[#5AA3E6]/5" },
                { tab: "payments", label: "Payments", icon: IndianRupee, color: "hover:border-emerald-400/40 hover:bg-emerald-50" },
                { tab: "leads", label: "Leads hub", icon: UserPlus, color: "hover:border-violet-400/40 hover:bg-violet-50" },
                { tab: "check-payment", label: "Check payment", icon: TrendingUp, color: "hover:border-blue-400/40 hover:bg-blue-50" },
                { tab: "unpaid-students", label: "Unpaid students", icon: ShoppingCart, color: "hover:border-amber-400/40 hover:bg-amber-50" },
                { tab: "attendance", label: "Attendance", icon: Activity, color: "hover:border-rose-400/40 hover:bg-rose-50" },
              ].map(({ tab, label, icon: Icon, color }) => (
                <button
                  key={tab}
                  type="button"
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 text-left transition-all duration-200",
                    "shadow-sm hover:shadow-md",
                    color
                  )}
                  onClick={() => onNavigateTab?.(tab)}
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#5AA3E6]/10 text-[#2B7CD3] transition-colors group-hover:bg-[#5AA3E6]/20">
                    <Icon className="size-4" />
                  </div>
                  <span className="flex-1 text-sm font-semibold text-slate-800">{label}</span>
                  <ArrowUpRight className="size-4 text-slate-300 transition-colors group-hover:text-[#5AA3E6]" />
                </button>
              ))}
            </div>
          </AdminContentCard>
        </div>
      </section>
    </div>
  );
}
