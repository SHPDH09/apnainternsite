import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, X } from "lucide-react";
import { RAZORPAY_CHECKOUT_END, RAZORPAY_CHECKOUT_START } from "@/lib/clientRazorpayPayment";
import { fetchPublicSitePopups } from "@/lib/sitePopupsApi";
import { isPopupLiveForLocation, type SitePopup } from "@/lib/sitePopups";

const DISMISS_PREFIX = "site-popup-dismissed:";

function dismissedIds(): Set<string> {
  const ids = new Set<string>();
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(DISMISS_PREFIX) && sessionStorage.getItem(key) === "1") {
        ids.add(key.slice(DISMISS_PREFIX.length));
      }
    }
  } catch {
    /* ignore */
  }
  return ids;
}

function markDismissed(id: string) {
  try {
    sessionStorage.setItem(`${DISMISS_PREFIX}${id}`, "1");
  } catch {
    /* ignore */
  }
}

/** Renders scheduled, page-targeted popups from Admin → Popup Management. */
export function SitePopupsHost() {
  const { pathname, hash } = useLocation();
  const [allPopups, setAllPopups] = useState<SitePopup[]>([]);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [dismissTick, setDismissTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchPublicSitePopups(supabase);
        if (!cancelled) setAllPopups(rows);
      } catch {
        if (!cancelled) setAllPopups([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const closeForPayment = () => {
      setCheckoutActive(true);
      document.body.style.pointerEvents = "auto";
      document.body.style.overflow = "";
      document.body.removeAttribute("data-scroll-locked");
      document.documentElement.removeAttribute("data-scroll-locked");
    };
    const onCheckoutEnd = () => setCheckoutActive(false);
    window.addEventListener(RAZORPAY_CHECKOUT_START, closeForPayment);
    window.addEventListener(RAZORPAY_CHECKOUT_END, onCheckoutEnd);
    return () => {
      window.removeEventListener(RAZORPAY_CHECKOUT_START, closeForPayment);
      window.removeEventListener(RAZORPAY_CHECKOUT_END, onCheckoutEnd);
    };
  }, []);

  const queue = useMemo(() => {
    const skipped = dismissedIds();
    return allPopups.filter(
      (p) => !skipped.has(p.id) && isPopupLiveForLocation(p, pathname, hash)
    );
  }, [allPopups, pathname, hash, dismissTick]);

  const current = queue[0] || null;

  const closeCurrent = () => {
    if (current) markDismissed(current.id);
    setDismissTick((n) => n + 1);
  };

  if (!current || checkoutActive) return null;

  const ctaHref = current.cta_url?.trim() || "";
  const ctaLabel = current.cta_label?.trim() || (ctaHref ? "Open" : "");
  const isImage = current.popup_type === "image" && current.image_url;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) closeCurrent(); }}>
      <DialogContent className="max-w-[90vw] sm:max-w-md border-primary/20 shadow-2xl rounded-3xl overflow-hidden p-0 [&>button]:hidden flex flex-col max-h-[90vh]">
        <div className="bg-primary p-5 text-white relative shrink-0">
          <div className="flex items-center gap-3 pr-10">
            <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Info className="size-6 text-white" />
            </div>
            <DialogHeader className="text-left w-full space-y-0">
              <DialogTitle className="text-xl font-black text-white leading-tight">
                {current.title || "Notice"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <button
            type="button"
            onClick={closeCurrent}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-all z-10 backdrop-blur-sm"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 bg-white overflow-y-auto flex-1">
          {isImage ? (
            ctaHref ? (
              <a href={ctaHref} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={current.image_url || ""}
                  alt={current.title || "Popup"}
                  className="w-full max-h-[60vh] object-contain rounded-xl"
                />
              </a>
            ) : (
              <img
                src={current.image_url || ""}
                alt={current.title || "Popup"}
                className="w-full max-h-[60vh] object-contain rounded-xl"
              />
            )
          ) : (
            <div className="text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
              {current.message}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row gap-2 shrink-0">
          {ctaHref && ctaLabel ? (
            <a href={ctaHref} target="_blank" rel="noopener noreferrer" className="w-full sm:flex-1">
              <Button className="w-full font-black rounded-xl">{ctaLabel}</Button>
            </a>
          ) : null}
          <Button variant="outline" className="w-full sm:flex-1 font-black rounded-xl" onClick={closeCurrent}>
            {queue.length > 1 ? "Next" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use SitePopupsHost at the app root. Kept so existing page imports keep compiling. */
export const NoticePopup = (_props?: { page?: string }) => null;
