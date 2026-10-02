import { Card } from "@/components/ui/card";
import { useWaCrm } from "@/wa-crm/context/WaCrmContext";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = ["#0ea5e9", "#22c55e", "#6366f1", "#f59e0b", "#ec4899", "#94a3b8", "#64748b"];

export function DashboardPage() {
  const { data } = useWaCrm();
  if (!data) return null;

  const kpi = data.kpis;
  const cards = [
    { label: "Total Contacts", value: kpi.totalContacts },
    { label: "New Leads", value: kpi.newLeads },
    { label: "Open Conversations", value: kpi.openConversations },
    { label: "Unread Messages", value: kpi.unreadMessages },
    { label: "AI Conversations", value: kpi.aiConversations },
    { label: "Today's Messages", value: kpi.todaysMessages },
    { label: "Campaign Messages", value: kpi.campaignMessages },
    { label: "Conversion Rate", value: `${kpi.conversionRate}%` },
  ];

  const volume = data.conversationVolume.week.map((v: number, i: number) => ({
    day: `D${i + 1}`,
    chats: v,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground">WhatsApp CRM overview — official Cloud API only</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4 rounded-xl shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
            <p className="text-2xl font-bold mt-1 text-slate-900">{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 rounded-xl">
          <h2 className="font-semibold mb-3">Conversation volume (7 days)</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volume}>
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="chats" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 rounded-xl">
          <h2 className="font-semibold mb-3">Lead sources</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.leadSources} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {data.leadSources.map((_: unknown, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4 rounded-xl overflow-x-auto">
        <h2 className="font-semibold mb-3">Agent performance</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2">Agent</th>
              <th>Chats</th>
              <th>Resolved</th>
              <th>Pending</th>
              <th>Response time</th>
            </tr>
          </thead>
          <tbody>
            {data.agents.map((a: { id: string; fullName: string; chats: number; resolved: number; pending: number; avgResponseMin: number }) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{a.fullName}</td>
                <td>{a.chats}</td>
                <td>{a.resolved}</td>
                <td>{a.pending}</td>
                <td>{a.avgResponseMin} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
