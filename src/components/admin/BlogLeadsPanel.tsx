import { useCallback, useEffect, useState } from "react";
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
import { AdminListPagination } from "@/components/admin/ui/AdminListPagination";
import {
  fetchAdminBlogLeadsPage,
  fetchAllAdminBlogLeads,
  type AdminBlogLeadRow,
} from "@/lib/blogLeadsAdmin";
import { formatBlogDate } from "@/lib/siteBlogApi";

const BLOG_LEADS_PAGE_SIZE = 20;

type Props = {
  client: SupabaseClient;
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function BlogLeadsPanel({ client }: Props) {
  const [rows, setRows] = useState<AdminBlogLeadRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [leadsPage, setLeadsPage] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: pageRows, total } = await fetchAdminBlogLeadsPage(client, {
        page: leadsPage,
        pageSize: BLOG_LEADS_PAGE_SIZE,
        phoneSearch,
        textSearch,
        dateFrom,
        dateTo,
      });
      setRows(pageRows);
      setTotalCount(total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load blog leads.");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [client, leadsPage, phoneSearch, textSearch, dateFrom, dateTo]);

  useEffect(() => {
    setLeadsPage(0);
  }, [phoneSearch, textSearch, dateFrom, dateTo]);

  useEffect(() => {
    const delay = textSearch.trim() || phoneSearch.trim() ? 300 : 0;
    const timer = setTimeout(() => {
      void reload();
    }, delay);
    return () => clearTimeout(timer);
  }, [reload, leadsPage, phoneSearch, textSearch, dateFrom, dateTo]);

  const downloadCsv = async () => {
    const toastId = toast.loading("Preparing CSV…");
    try {
      const all = await fetchAllAdminBlogLeads(client, {
        phoneSearch,
        textSearch,
        dateFrom,
        dateTo,
      });
      const header = ["Date", "Name", "Email", "Phone", "College", "Post title", "Post slug"];
      const lines = [
        header.join(","),
        ...all.map((r) =>
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
      toast.success(`Exported ${all.length} leads`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed", { id: toastId });
    }
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
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => void downloadCsv()}
            disabled={!totalCount}
          >
            <Download className="mr-2 size-4" /> Download CSV
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {totalCount} blog reader leads (server-paginated).
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-[#5AA3E6]" />
        </div>
      ) : totalCount === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No blog leads yet.</p>
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
              {rows.map((r) => (
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
      {!loading && totalCount > 0 ? (
        <AdminListPagination
          page={leadsPage}
          pageSize={BLOG_LEADS_PAGE_SIZE}
          total={totalCount}
          onPageChange={setLeadsPage}
          label="Leads"
        />
      ) : null}
    </div>
  );
}
