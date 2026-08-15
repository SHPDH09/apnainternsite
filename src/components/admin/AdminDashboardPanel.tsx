import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Download,
  IndianRupee,
  Loader2,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
  isPaymentsLoading?: boolean;
  onExportCsv: () => void;
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

  return { todayRevenue, growth, todayEnrolledCount, todayLeadsCount };
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

export function AdminDashboardPanel({
  payments,
  cancelledPayments,
  studentTotalCount,
  isPaymentsLoading,
  onExportCsv,
}: AdminDashboardPanelProps) {
  const [dashStartDate, setDashStartDate] = useState("");
  const [dashEndDate, setDashEndDate] = useState("");
  const [livePulse, setLivePulse] = useState<{ name: string; value: number }[]>(
    Array.from({ length: 12 }, (_, i) => ({ name: i.toString(), value: 40 + Math.random() * 20 }))
  );
  const [liveTraffic, setLiveTraffic] = useState(86);
  const [monitoringStatus, setMonitoringStatus] = useState("Monitoring");

  useEffect(() => {
    const interval = setInterval(() => {
      setLivePulse((prev) => {
        const newVal = 35 + Math.random() * 35;
        return [...prev.slice(1), { name: Date.now().toString(), value: newVal }];
      });
      setLiveTraffic((prev) => prev + (Math.random() > 0.5 ? 1 : -1));

      const statuses = ["Monitoring", "Node active", "Traffic stable", "System optimized"];
      setMonitoringStatus(statuses[Math.floor(Math.random() * statuses.length)]!);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(
    () => getDashboardStats(payments, cancelledPayments),
    [payments, cancelledPayments]
  );

  const chartData = useMemo(
    () => filterRevenueByDate(payments, dashStartDate, dashEndDate),
    [payments, dashStartDate, dashEndDate]
  );

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
          <div className="flex flex-wrap gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Students today</span>
              <p className="font-semibold text-foreground">{stats.todayEnrolledCount}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Leads today</span>
              <p className="font-semibold text-foreground">{stats.todayLeadsCount}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Revenue today</span>
              <p className="font-semibold text-emerald-600">
                ₹{stats.todayRevenue.toLocaleString()}
              </p>
            </div>
          </div>

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
        </AdminContentCard>

        <AdminContentCard
          title="Platform health"
          description="Live traffic and API status."
          bodyClassName="space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{monitoringStatus}</p>
              <p className="text-xs text-muted-foreground">Traffic: {liveTraffic} req/s</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">API response</span>
              <span className="font-medium text-emerald-600">Stable</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[92%] rounded-full bg-primary/80" />
            </div>
          </div>

          <ChartContainer
            config={{
              value: { label: "Traffic", color: "hsl(var(--primary))" },
            }}
            className="h-[120px] w-full"
          >
            <AreaChart data={livePulse} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                fill="hsl(var(--primary))"
                fillOpacity={0.12}
                isAnimationActive
                animationDuration={800}
              />
            </AreaChart>
          </ChartContainer>
        </AdminContentCard>
      </div>
    </div>
  );
}
