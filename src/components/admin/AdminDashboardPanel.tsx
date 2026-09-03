import { useMemo, useState } from "react";
import {
  Activity,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AdminContentCard,
  AdminPageHeader,
  AdminStatCard,
} from "@/components/admin/ui";

type PaymentRow = {
  created_at: string;
  amount_paise: number;
};

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
    yesterdayRevenue === 0 ? 100 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;

  const totalRevenue = payments.reduce((acc, p) => acc + p.amount_paise / 100, 0);
  const avgOrderValue = payments.length ? totalRevenue / payments.length : 0;

  return { todayRevenue, growth, todayEnrolledCount, todayLeadsCount, avgOrderValue };
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
    const date = new Date(p.created_at).toLocaleDateString();
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
  const [dashStartDate, setDashStartDate] = useState("");
  const [dashEndDate, setDashEndDate] = useState("");

  const stats = useMemo(
    () => getDashboardStats(payments, cancelledPayments),
    [payments, cancelledPayments]
  );

  const chartData = useMemo(
    () => filterRevenueByDate(payments, dashStartDate, dashEndDate),
    [payments, dashStartDate, dashEndDate]
  );

  const weekdayData = useMemo(() => {
    let filtered = payments;
    if (dashStartDate) filtered = filtered.filter((p) => p.created_at >= `${dashStartDate}T00:00:00`);
    if (dashEndDate) filtered = filtered.filter((p) => p.created_at <= `${dashEndDate}T23:59:59`);
    return paymentsByDayOfWeek(filtered);
  }, [payments, dashStartDate, dashEndDate]);

  const dateToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        value={dashStartDate}
        onChange={(e) => setDashStartDate(e.target.value)}
        className="h-9 w-[9.5rem]"
        aria-label="Start date"
      />
      <Input
        type="date"
        value={dashEndDate}
        onChange={(e) => setDashEndDate(e.target.value)}
        className="h-9 w-[9.5rem]"
        aria-label="End date"
      />
      <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onExportCsv}>
        <Download className="size-4" />
        Export
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Overview of enrollment, revenue, and platform activity."
        actions={dateToolbar}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Enrolled students"
          value={studentTotalCount.toLocaleString()}
          hint="Active internship period"
          icon={Users}
        />
        <AdminStatCard
          label="Today's revenue"
          value={`₹${stats.todayRevenue.toLocaleString()}`}
          icon={IndianRupee}
          trend={{ value: stats.growth, label: "vs yesterday" }}
          loading={isPaymentsLoading && payments.length === 0}
        />
        <AdminStatCard
          label="New enrollments today"
          value={stats.todayEnrolledCount.toLocaleString()}
          hint="Completed payments"
          icon={TrendingUp}
        />
        <AdminStatCard
          label="Abandoned carts"
          value={cancelledPayments.length.toLocaleString()}
          hint={`${stats.todayLeadsCount} today · follow-up needed`}
          icon={ShoppingCart}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminContentCard
          className="lg:col-span-2"
          title="Revenue"
          description="Payment volume for the selected date range."
          action={
            isPaymentsLoading && payments.length === 0 ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />
            ) : null
          }
          bodyClassName="space-y-4"
        >
          {chartData.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
              No payments in this date range
            </div>
          ) : (
            <ChartContainer
              config={{
                amount: { label: "Revenue", color: "hsl(var(--primary))" },
              }}
              className="h-[240px] w-full"
            >
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => `₹${v}`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-medium">₹{Number(value).toLocaleString()}</span>
                      )}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#adminRevenueFill)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </AdminContentCard>

        <AdminContentCard
          title="Enrollments by day"
          description="Weekday distribution for selected range."
          bodyClassName="space-y-4"
        >
          <ChartContainer
            config={{
              count: { label: "Payments", color: "hsl(var(--primary))" },
            }}
            className="h-[240px] w-full"
          >
            <BarChart data={weekdayData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </AdminContentCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminContentCard
          title="Site traffic"
          description="Public homepage analytics."
          bodyClassName="space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{visitorCount.toLocaleString()} page views</p>
              <p className="text-xs text-muted-foreground">
                {uniqueVisitorCount.toLocaleString()} unique visitors
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Avg order value: ₹{stats.avgOrderValue.toFixed(0)}
          </p>
        </AdminContentCard>

        <AdminContentCard
          className="lg:col-span-2"
          title="Quick actions"
          description="Jump to frequently used admin modules."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { tab: "students", label: "Student directory", icon: Users },
              { tab: "payments", label: "Payments & revenue", icon: IndianRupee },
              { tab: "leads", label: "Leads hub", icon: UserPlus },
              { tab: "check-payment", label: "Check payment ID", icon: TrendingUp },
              { tab: "unpaid-students", label: "Unpaid students", icon: ShoppingCart },
              { tab: "attendance", label: "Attendance", icon: Activity },
            ].map(({ tab, label, icon: Icon }) => (
              <Button
                key={tab}
                type="button"
                variant="outline"
                className="h-10 justify-start gap-2"
                onClick={() => onNavigateTab?.(tab)}
              >
                <Icon className="size-4 text-primary" />
                {label}
              </Button>
            ))}
          </div>
        </AdminContentCard>
      </div>
    </div>
  );
}
