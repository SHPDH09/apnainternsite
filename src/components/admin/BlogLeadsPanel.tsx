import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminCardClass } from "@/components/admin/ui/adminStyles";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { formatBlogDate } from "@/lib/siteBlogApi";

export type SiteBlogLead = {
  id: string;
  post_id?: string | null;
  post_slug?: string | null;
  post_title?: string | null;
  full_name: string;
  email: string;
  phone: string;
  college_name?: string | null;
  created_at?: string | null;
};

type Props = {
  client: SupabaseClient;
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function BlogLeadsPanel({ client }: Props) {
  const [rows, setRows] = useState<SiteBlogLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllSupabaseRows(client, "site_blog_leads", {
        order: { column: "created_at", ascending: false },
      });
      setRows((data || []) as SiteBlogLead[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load blog leads.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const phoneQ = phoneSearch.replace(/\D/g, "");
    const textQ = textSearch.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return rows.filter((r) => {
      if (phoneQ) {
        const p = String(r.phone || "").replace(/\D/g, "");
        if (!p.includes(phoneQ)) return false;
      }
      if (textQ) {
        const blob = [r.full_name, r.email, r.college_name, r.post_title, r.post_slug]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");
        if (!blob.includes(textQ)) return false;
      }
      if (fromTs || toTs) {
        const ts = r.created_at ? new Date(r.created_at).getTime() : NaN;
        if (Number.isNaN(ts)) return false;
        if (fromTs != null && ts < fromTs) return false;
        if (toTs != null && ts > toTs) return false;
      }
      return true;
    });
  }, [rows, phoneSearch, textSearch, dateFrom, dateTo]);

  const downloadCsv = () => {
    const header = ["Date", "Name", "Email", "Phone", "College", "Post title", "Post slug"];
    const lines = [
      header.join(","),
      ...filtered.map((r) =>
        [
          r.created_at ? new Date(r.created_at).toISOString() : "",
          r.full_name,
          r.email,
          r.phone,
          r.college_name || "",
          r.post_title || "",
          r.post_slug || "",
        ]
          .map((c) => csvEscape(String(c)))
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blog-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className={adminCardClass + " p-4"}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">Search name / email / college / post</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-8"
                  placeholder="Search…"
                  value={textSearch}
                  onChange={(e) => setTextSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Phone number</Label>
              <Input
                inputMode="tel"
                placeholder="Digits only"
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">From date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">To date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <Button type="button" variant="outline" className="shrink-0" onClick={downloadCsv} disabled={!filtered.length}>
            <Download className="mr-2 size-4" /> Download CSV
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Showing {filtered.length} of {rows.length} leads from blog reader popups.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-[#5AA3E6]" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No blog leads match your filters.</p>
      ) : (
        <ScrollArea className={adminCardClass + " max-h-[560px]"}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>College</TableHead>
                <TableHead>Post</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-600">
                    {formatBlogDate(r.created_at) || "—"}
                    <div className="text-[10px] text-slate-400">
                      {r.created_at ? new Date(r.created_at).toLocaleTimeString("en-IN") : ""}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">{r.email}</div>
                    <div className="text-xs text-slate-500">{r.phone}</div>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm">{r.college_name || "—"}</TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate text-sm font-medium">{r.post_title || "—"}</div>
                    <div className="truncate text-xs text-slate-400">{r.post_slug || ""}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}
