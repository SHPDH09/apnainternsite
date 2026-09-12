import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminContentCard, AdminPageHeader } from "@/components/admin/ui";
import { apiUrl } from "@/lib/siteApi";

type LookupResult = {
  source: "order" | "payment" | "email" | "razorpay";
  status?: string;
  paymentId?: string;
  orderId?: string;
  email?: string;
  raw?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
};

async function lookupLocalPayment(query: string): Promise<LookupResult | null> {
  const q = query.trim();
  if (!q) return null;

  let url: string;
  if (q.startsWith("order_") || q.startsWith("order")) {
    url = apiUrl(`/api/payment/status?orderId=${encodeURIComponent(q)}`);
  } else if (q.startsWith("pay_")) {
    url = apiUrl(`/api/payment/status?paymentId=${encodeURIComponent(q)}`);
  } else if (q.includes("@")) {
    url = apiUrl(`/api/payment/status?email=${encodeURIComponent(q.toLowerCase())}`);
  } else {
    return null;
  }

  const res = await fetch(url);
  const data = (await res.json()) as {
    success?: boolean;
    source?: LookupResult["source"];
    status?: string;
    paymentId?: string;
    orderId?: string;
    email?: string;
    rows?: Array<Record<string, unknown>>;
    message?: string;
  };

  if (!res.ok || !data.success) return null;

  return {
    source: data.source || (q.startsWith("order") ? "order" : q.startsWith("pay_") ? "payment" : "email"),
    status: data.status,
    paymentId: data.paymentId,
    orderId: data.orderId,
    email: data.email,
    rows: data.rows,
  };
}

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
      const local = await lookupLocalPayment(q);
      if (local) {
        setResult(local);
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
        description="Search stored payment records first, then fall back to Razorpay when needed."
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
              Enter a payment or order identifier. Local database records are checked before Razorpay.
            </div>
          ) : null}

          {result ? (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {result.source === "razorpay"
                    ? "Razorpay API"
                    : result.source === "order"
                      ? "Local order"
                      : result.source === "email"
                        ? "Local email search"
                        : "Local payment"}
                </Badge>
                {result.status ? <Badge className="capitalize">{result.status}</Badge> : null}
              </div>
              {result.paymentId ? (
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Payment ID:</span>{" "}
                  <code className="rounded bg-background px-2 py-0.5 text-xs">{result.paymentId}</code>
                </p>
              ) : null}
              {result.orderId ? (
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Order ID:</span>{" "}
                  <code className="rounded bg-background px-2 py-0.5 text-xs">{result.orderId}</code>
                </p>
              ) : null}
              {result.email ? (
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Email:</span> {result.email}
                </p>
              ) : null}
              {result.rows && result.rows.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  {result.rows.length} matching payment record(s) in database.
                </p>
              ) : null}
              {result.raw ? (
                <pre className="max-h-64 overflow-auto rounded bg-background p-3 text-xs">
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
