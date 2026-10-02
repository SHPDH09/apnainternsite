import { Link } from "react-router-dom";
import { useWaCrm } from "@/wa-crm/context/WaCrmContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactsPage() {
  const { data } = useWaCrm();
  const rows = data?.contacts ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <div className="flex gap-2">
          <Button variant="outline">Import CSV</Button>
          <Button variant="outline">Export CSV</Button>
          <Button>Add contact</Button>
        </div>
      </div>
      <Card className="overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th>Phone</th>
              <th>Source</th>
              <th>Status</th>
              <th>Opt-in</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c: { id: string; fullName: string; whatsappNumber: string; source: string; leadStatus: string; optIn: boolean; tags: string[] }) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.fullName}</td>
                <td>+{c.whatsappNumber}</td>
                <td>{c.source}</td>
                <td>{c.leadStatus}</td>
                <td>{c.optIn ? "Yes" : "No"}</td>
                <td className="py-2">
                  {c.tags?.map((t) => (
                    <Badge key={t} variant="secondary" className="mr-1">
                      {t}
                    </Badge>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const STAGES = ["new", "contacted", "qualified", "interested", "follow_up", "converted", "lost"];

export function LeadsPage() {
  const { data } = useWaCrm();
  const leads = data?.leads ?? [];
  const contacts = data?.contacts ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leads pipeline</h1>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <Card key={stage} className="min-w-[200px] flex-1 rounded-xl p-3 bg-slate-50">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{stage.replace("_", " ")}</p>
            <div className="space-y-2">
              {leads
                .filter((l: { stage: string }) => l.stage === stage)
                .map((l: { id: string; title: string; contactId: string }) => {
                  const c = contacts.find((x: { id: string }) => x.id === l.contactId);
                  return (
                    <div key={l.id} className="rounded-lg border bg-white p-2 shadow-sm cursor-grab">
                      <p className="text-sm font-medium">{c?.fullName || l.title}</p>
                      <p className="text-[10px] text-muted-foreground">{l.title}</p>
                    </div>
                  );
                })}
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Drag-and-drop Kanban wiring connects to RDS lead stages in production.</p>
    </div>
  );
}

export function CampaignsPage() {
  const { data } = useWaCrm();
  const rows = data?.campaigns ?? [];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Button asChild>
          <Link to="/admin/wa-crm/campaigns/create">+ Create campaign</Link>
        </Button>
      </div>
      <div className="grid gap-3">
        {rows.map((c: { id: string; name: string; status: string; sent: number; delivered: number; read: number; replied: number; failed: number }) => (
          <Card key={c.id} className="p-4 rounded-xl flex flex-wrap justify-between gap-3">
            <div>
              <p className="font-semibold">{c.name}</p>
              <Badge variant="outline" className="mt-1 capitalize">
                {c.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground grid grid-cols-3 sm:grid-cols-6 gap-3">
              <span>Sent {c.sent}</span>
              <span>Delivered {c.delivered}</span>
              <span>Read {c.read}</span>
              <span>Replied {c.replied}</span>
              <span>Failed {c.failed}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function CampaignCreatePage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Create campaign</h1>
      {["Campaign details", "Audience", "Template", "Preview", "Compliance", "Schedule"].map((step, i) => (
        <Card key={step} className="p-4 rounded-xl space-y-3">
          <p className="text-xs font-bold text-sky-600">STEP {i + 1}</p>
          <h2 className="font-semibold">{step}</h2>
          {i === 0 && <Input placeholder="Campaign name" defaultValue="Course Promotion Q4" />}
          {i === 1 && <Input placeholder="Tag = Student AND Location = Bihar" />}
          {i === 2 && <Input placeholder="Approved template" defaultValue="Course Promotion" />}
          {i === 3 && (
            <div className="rounded-lg border p-4 bg-emerald-50 text-sm whitespace-pre-wrap">
              {`Hello {{name}},\n\nYour {{course}} registration is now open.\n\n[Learn More]`}
            </div>
          )}
          {i === 4 && (
            <ul className="text-sm space-y-1 text-emerald-700">
              <li>✓ Opt-in verified</li>
              <li>✓ Approved template</li>
              <li>✓ Duplicate check</li>
              <li>✓ Invalid numbers removed</li>
            </ul>
          )}
          {i === 5 && (
            <div className="flex gap-2">
              <Button variant="outline">Save draft</Button>
              <Button variant="outline">Schedule</Button>
              <Button>Launch (queue)</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export function TemplatesPage() {
  const { data } = useWaCrm();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Message templates</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {(data?.templates ?? []).map((t: { id: string; name: string; category: string; status: string; body: string }) => (
          <Card key={t.id} className="p-4 rounded-xl">
            <div className="flex justify-between">
              <p className="font-semibold">{t.name}</p>
              <Badge capitalize>{t.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 capitalize">{t.category}</p>
            <p className="text-sm mt-3 whitespace-pre-wrap">{t.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AiPage() {
  const { data } = useWaCrm();
  const s = data?.aiSettings;
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-5 rounded-xl space-y-4">
        <h1 className="text-xl font-bold">AI control center</h1>
        <p className="text-sm text-muted-foreground">Status: {s?.enabled ? "ON" : "OFF"} (demo)</p>
        <Label>System instructions</Label>
        <Textarea rows={4} defaultValue={s?.systemInstructions} />
        <Label>Confidence threshold</Label>
        <Input type="number" step="0.05" defaultValue={s?.confidenceThreshold} />
        <Label>Fallback message</Label>
        <Input defaultValue={s?.fallbackMessage} />
        <Button>Save AI settings</Button>
      </Card>
      <Card className="p-5 rounded-xl">
        <h2 className="font-semibold mb-3">Test chat</h2>
        <p className="text-sm bg-muted p-3 rounded-lg">Customer: Machine Learning course ka fee kya hai?</p>
        <p className="text-sm bg-sky-50 p-3 rounded-lg mt-2">
          AI: Our Machine Learning course is available for ₹2,599. Would you like course details?
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin/wa-crm/ai/knowledge">Manage knowledge base</Link>
        </Button>
      </Card>
    </div>
  );
}

export function AiKnowledgePage() {
  return (
    <Card className="p-5 rounded-xl space-y-3 max-w-2xl">
      <h1 className="text-xl font-bold">AI knowledge base</h1>
      <p className="text-sm text-muted-foreground">Add FAQs, PDFs, pricing, and policies for RAG retrieval.</p>
      <Button>Add FAQ</Button>
      <Button variant="outline">Upload document</Button>
    </Card>
  );
}

export function AutomationPage() {
  return (
    <Card className="p-6 rounded-xl">
      <h1 className="text-xl font-bold mb-4">Automation builder</h1>
      <div className="flex flex-col items-center gap-2 max-w-md mx-auto text-sm">
        {["TRIGGER: New WhatsApp message", "CONDITION: contains \"course\"", "ACTION: Send approved template", "ACTION: Create lead", "ACTION: Assign sales team"].map(
          (step) => (
            <div key={step} className="w-full rounded-lg border bg-white p-3 shadow-sm text-center">
              {step}
            </div>
          )
        )}
      </div>
    </Card>
  );
}

export function AnalyticsPage() {
  const { data } = useWaCrm();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4 rounded-xl">
          <p className="text-xs text-muted-foreground">AI resolution rate</p>
          <p className="text-3xl font-bold">68%</p>
        </Card>
        <Card className="p-4 rounded-xl">
          <p className="text-xs text-muted-foreground">Avg first response</p>
          <p className="text-3xl font-bold">4.1m</p>
        </Card>
        <Card className="p-4 rounded-xl">
          <p className="text-xs text-muted-foreground">Campaign reply rate</p>
          <p className="text-3xl font-bold">11%</p>
        </Card>
      </div>
      <Card className="p-4 rounded-xl text-sm text-muted-foreground">
        Export reports to CSV — wired to campaign_events and message analytics tables.
      </Card>
    </div>
  );
}

export function TeamPage() {
  const { data } = useWaCrm();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Team</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {(data?.agents ?? []).map((a: { id: string; fullName: string; email: string; team: string; status: string }) => (
          <Card key={a.id} className="p-4 rounded-xl">
            <p className="font-semibold">{a.fullName}</p>
            <p className="text-sm text-muted-foreground">{a.email}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline">{a.team}</Badge>
              <Badge capitalize>{a.status}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function WhatsAppSettingsPage() {
  const { data } = useWaCrm();
  const w = data?.whatsappConfig;
  return (
    <Card className="p-5 rounded-xl max-w-xl space-y-4">
      <h1 className="text-xl font-bold">WhatsApp Cloud API</h1>
      <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
        Store tokens in server environment variables only — never in the browser.
      </p>
      <div className="space-y-2 text-sm">
        <Label>Business name</Label>
        <Input defaultValue={w?.businessName} readOnly />
        <Label>Phone number ID (WHATSAPP_PHONE_NUMBER_ID)</Label>
        <Input placeholder="Set in server .env" readOnly />
        <Label>Access token (WHATSAPP_ACCESS_TOKEN)</Label>
        <Input type="password" value="••••••••" readOnly />
        <Label>Webhook verify token</Label>
        <Input placeholder="WHATSAPP_WEBHOOK_VERIFY_TOKEN" readOnly />
      </div>
      <Badge variant={w?.configured ? "default" : "secondary"}>
        {w?.configured ? "Connected" : "Demo mode — not connected"}
      </Badge>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <Card className="p-5 rounded-xl max-w-xl space-y-3">
      <h1 className="text-xl font-bold">Settings</h1>
      <Label>Business timezone</Label>
      <Input defaultValue="Asia/Kolkata" />
      <Label>Currency</Label>
      <Input defaultValue="INR" />
      <Button>Save general settings</Button>
    </Card>
  );
}

export function CompliancePage() {
  const { data } = useWaCrm();
  const c = data?.compliance;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">WhatsApp compliance</h1>
      <p className="text-sm text-muted-foreground">Compliance-first campaigns — no anti-ban or policy bypass features.</p>
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4 rounded-xl">
          <p className="text-xs text-muted-foreground">Opt-in contacts</p>
          <p className="text-2xl font-bold">{c?.optInContacts}</p>
        </Card>
        <Card className="p-4 rounded-xl">
          <p className="text-xs text-muted-foreground">Opt-out contacts</p>
          <p className="text-2xl font-bold">{c?.optOutContacts}</p>
        </Card>
        <Card className="p-4 rounded-xl">
          <p className="text-xs text-muted-foreground">Suppressed</p>
          <p className="text-2xl font-bold">{c?.suppressed}</p>
        </Card>
      </div>
    </div>
  );
}
