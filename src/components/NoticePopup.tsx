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
import { StorageImage } from "@/components/StorageImage";

const LEGACY_DISMISS_PREFIX = "site-popup-dismissed:";

function clearLegacyPopupDismissals() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(LEGACY_DISMISS_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/** Popups repeat on each page visit (route change or refresh). Dismiss only lasts for the current URL. */
export function SitePopupsHost() {
  const { pathname, hash } = useLocation();
  const routeKey = `${pathname}${hash || ""}`;
  const [allPopups, setAllPopups] = useState<SitePopup[]>([]);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    clearLegacyPopupDismissals();
  }, []);

  useEffect(() => {
    setDismissedIds(new Set());
  }, [routeKey]);

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
  }, [routeKey]);

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
    return allPopups.filter(
      (p) => !dismissedIds.has(p.id) && isPopupLiveForLocation(p, pathname, hash)
    );
  }, [allPopups, pathname, hash, dismissedIds]);

  const current = queue[0] || null;

  const closeCurrent = () => {
    if (current) {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(current.id);
        return next;
      });
    }
  };

  if (!current || checkoutActive) return null;

  const ctaHref = current.cta_url?.trim() || "";
  const ctaLabel = current.cta_label?.trim() || (ctaHref ? "Open" : "");
  const isImage =
    current.popup_type === "image" && Boolean(current.image_path?.trim() || current.image_url?.trim());

  const imageClassName =
    "block w-full h-auto max-h-[70vh] m-0 p-0 rounded-none border-0 align-top";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) closeCurrent(); }}>
      <DialogContent
        className={
          isImage
            ? "max-w-[min(96vw,520px)] sm:max-w-lg border-primary/20 shadow-2xl rounded-3xl overflow-hidden p-0 gap-0 [&>button]:hidden flex flex-col max-h-[92vh]"
            : "max-w-[90vw] sm:max-w-md border-primary/20 shadow-2xl rounded-3xl overflow-hidden p-0 [&>button]:hidden flex flex-col max-h-[90vh]"
        }
      >
        <div className="bg-primary px-5 py-4 text-white relative shrink-0">
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
            className="absolute top-3.5 right-3.5 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-all z-10 backdrop-blur-sm"
          >
            <X className="size-4" />
          </button>
        </div>

        {isImage ? (
          <div className="bg-white overflow-hidden flex-1 min-h-0 leading-[0]">
            {ctaHref ? (
              <a href={ctaHref} target="_blank" rel="noopener noreferrer" className="block w-full m-0 p-0">
                <StorageImage
                  bucket="logos"
                  path={current.image_path}
                  url={current.image_url}
                  alt={current.title || "Popup"}
                  className={imageClassName}
                />
              </a>
            ) : (
              <StorageImage
                bucket="logos"
                path={current.image_path}
                url={current.image_url}
                alt={current.title || "Popup"}
                className={imageClassName}
              />
            )}
          </div>
        ) : (
          <div className="p-5 bg-white overflow-y-auto flex-1">
            <div className="text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
              {current.message}
            </div>
          </div>
        )}

        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row gap-2 shrink-0 m-0">
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
