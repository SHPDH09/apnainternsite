import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminContentCard, AdminPageHeader } from "@/components/admin/ui";
import { apiUrl } from "@/lib/siteApi";

type LookupResult = {
  source: "order" | "razorpay";
  status?: string;
  paymentId?: string;
  raw?: Record<string, unknown>;
};

export function CheckPaymentPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  const lookup = async () => {
    const q = query.trim();
    if (!q) {
      toast.error("Enter a Razorpay Payment ID (pay_…), Order ID, or email");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      if (q.startsWith("order_") || q.startsWith("order")) {
        const res = await fetch(apiUrl(`/api/payment/status?orderId=${encodeURIComponent(q)}`));
        const data = (await res.json()) as {
          success?: boolean;
          status?: string;
          paymentId?: string;
          message?: string;
        };
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Order not found");
        }
        setResult({
          source: "order",
          status: data.status,
          paymentId: data.paymentId,
        });
        return;
      }

      const res = await fetch(apiUrl("/api/razorpay-recovery"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch_razorpay_payment", query: q }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        payment?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment lookup failed");
      }
      setResult({
        source: "razorpay",
        status: String(data.payment?.status || ""),
        paymentId: String(data.payment?.id || q),
        raw: data.payment,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AdminPageHeader
        title="Check Payment"
        description="Look up Razorpay payment IDs, order IDs, or payer email to recover orphaned transactions."
      />

      <AdminContentCard
        title="Transaction lookup"
        description="Examples: pay_xxxxxxxx, order_xxxxxxxx, student@email.com"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="pay_… or order_… or email"
              className="h-10 font-mono text-sm"
              onKeyDown={(e) => e.key === "Enter" && void lookup()}
            />
            <Button type="button" className="h-10 gap-2" disabled={loading} onClick={() => void lookup()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Lookup
            </Button>
          </div>

          {!result && !loading ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              Enter a payment or order identifier to fetch live gateway status.
            </div>
          ) : null}

          {result ? (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {result.source === "order" ? "Local order" : "Razorpay API"}
                </Badge>
                {result.status ? <Badge className="capitalize">{result.status}</Badge> : null}
              </div>
              {result.paymentId ? (
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Payment ID:</span>{" "}
                  <code className="rounded bg-background px-2 py-0.5 text-xs">{result.paymentId}</code>
                </p>
              ) : null}
              {result.raw ? (
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                  {JSON.stringify(result.raw, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </AdminContentCard>
    </div>
  );
}
