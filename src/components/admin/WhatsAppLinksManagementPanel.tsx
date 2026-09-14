import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
  createWhatsAppLink,
  deleteWhatsAppLink,
  fetchAdminWhatsAppLinks,
  updateWhatsAppLink,
  type SiteWhatsAppWrite,
} from "@/lib/siteContactApi";
import {
  WHATSAPP_DISPLAY_CONTEXT_OPTIONS,
  WHATSAPP_LINK_TYPE_OPTIONS,
  type SiteWhatsAppLink,
} from "@/lib/siteContacts";

type Props = {
  client: SupabaseClient;
};

type FormState = {
  title: string;
  link_type: SiteWhatsAppLink["link_type"];
  url: string;
  description: string;
  display_contexts: string[];
  is_active: boolean;
  sort_order: number;
};

const emptyForm = (): FormState => ({
  title: "",
  link_type: "channel",
  url: "",
  description: "",
  display_contexts: ["registration"],
  is_active: false,
  sort_order: 0,
});

function formFromRow(row: SiteWhatsAppLink): FormState {
  return {
    title: row.title || "",
    link_type: row.link_type || "channel",
    url: row.url || "",
    description: row.description || "",
    display_contexts: row.display_contexts?.length ? row.display_contexts : [],
    is_active: row.is_active === true,
    sort_order: row.sort_order ?? 0,
  };
}

function contextsLabel(contexts: string[]): string {
  if (!contexts?.length) return "Hidden (no placement)";
  if (contexts.includes("all")) return "All pages";
  return contexts
    .map((k) => WHATSAPP_DISPLAY_CONTEXT_OPTIONS.find((o) => o.key === k)?.label || k)
    .join(", ");
}

function toWritePayload(form: FormState): SiteWhatsAppWrite {
  const contexts = form.display_contexts.includes("all")
    ? ["all"]
    : form.display_contexts.filter((c) => c !== "all");
  return {
    title: form.title.trim() || "WhatsApp link",
    link_type: form.link_type,
    url: form.url.trim(),
    description: form.description.trim() || null,
    display_contexts: contexts,
    is_active: form.is_active,
    sort_order: Number(form.sort_order) || 0,
  };
}

export function WhatsAppLinksManagementPanel({ client }: Props) {
  const [rows, setRows] = useState<SiteWhatsAppLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SiteWhatsAppLink | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminWhatsAppLinks(client));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load WhatsApp links.";
      if (/relation .*site_whatsapp_links.* does not exist|Could not find the table/i.test(msg)) {
        toast.error("Run the site_contacts SQL migration, then reload.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: SiteWhatsAppLink) => {
    setEditing(row);
    setForm(formFromRow(row));
    setDialogOpen(true);
  };

  const toggleContext = (key: string, checked: boolean) => {
    setForm((prev) => {
      if (key === "all") {
        return { ...prev, display_contexts: checked ? ["all"] : [] };
      }
      const without = prev.display_contexts.filter((c) => c !== "all" && c !== key);
      return { ...prev, display_contexts: checked ? [...without, key] : without };
    });
  };

  const handleSave = async () => {
    if (!form.url.trim()) {
      toast.error("WhatsApp URL is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = toWritePayload(form);
      if (editing) {
        await updateWhatsAppLink(client, editing.id, payload);
        toast.success("WhatsApp link updated.");
      } else {
        await createWhatsAppLink(client, payload);
        toast.success("WhatsApp link added.");
      }
      setDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: SiteWhatsAppLink) => {
    if (!window.confirm(`Delete "${row.title || row.url}"?`)) return;
    try {
      await deleteWhatsAppLink(client, row.id);
      toast.success("Deleted.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const handleToggleActive = async (row: SiteWhatsAppLink) => {
    try {
      await updateWhatsAppLink(client, row.id, { is_active: !row.is_active });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <MessageSquare className="size-5 text-[#25D366]" />
            WhatsApp Groups &amp; Channels
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage WhatsApp group links, channel links, and numbers. Control where they appear and enable or disable each link individually.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white">
          <Plus className="size-4" /> Add link
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          No WhatsApp links yet. Links are hidden from the website until you enable them.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm"
            >
              <div className="flex-1 min-w-[200px]">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] font-black uppercase">
                    {row.link_type}
                  </Badge>
                  {!row.is_active && (
                    <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">Order: {row.sort_order}</span>
                  <span className="text-xs text-muted-foreground">{contextsLabel(row.display_contexts)}</span>
                </div>
                <p className="font-bold text-slate-900">{row.title || "—"}</p>
                <p className="text-sm text-slate-600 break-all">{row.url}</p>
                {row.description && (
                  <p className="text-[11px] text-muted-foreground mt-1">{row.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2">
                  <Switch checked={row.is_active} onCheckedChange={() => void handleToggleActive(row)} />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Active</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void handleDelete(row)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit WhatsApp link" : "Add WhatsApp link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Registration updates channel" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.link_type}
                onValueChange={(v) => setForm((f) => ({ ...f, link_type: v as SiteWhatsAppLink["link_type"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WHATSAPP_LINK_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://whatsapp.com/channel/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Short helper text shown near the link"
              />
            </div>
            <div className="space-y-2">
              <Label>Show on</Label>
              {WHATSAPP_DISPLAY_CONTEXT_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.display_contexts.includes(opt.key) || form.display_contexts.includes("all")}
                    onCheckedChange={(v) => toggleContext(opt.key, !!v)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: !!v }))} />
                <Label>Enabled</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="bg-[#25D366] hover:bg-[#20bd5a]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
