import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicSiteContacts,
  fetchPublicWhatsAppLinks,
} from "@/lib/siteContactApi";
import type { DisplayContext, SiteContactDetail, SiteWhatsAppLink } from "@/lib/siteContacts";

type Cache = {
  contacts: SiteContactDetail[];
  whatsapp: SiteWhatsAppLink[];
};

const cache = new Map<string, Cache>();

export function usePublicSiteContacts(context: DisplayContext) {
  const [contacts, setContacts] = useState<SiteContactDetail[]>([]);
  const [whatsappLinks, setWhatsappLinks] = useState<SiteWhatsAppLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const key = context;
    const hit = cache.get(key);
    if (hit) {
      setContacts(hit.contacts);
      setWhatsappLinks(hit.whatsapp);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetchPublicSiteContacts(supabase, context).catch(() => [] as SiteContactDetail[]),
      fetchPublicWhatsAppLinks(supabase, context).catch(() => [] as SiteWhatsAppLink[]),
    ])
      .then(([c, w]) => {
        if (cancelled) return;
        cache.set(key, { contacts: c, whatsapp: w });
        setContacts(c);
        setWhatsappLinks(w);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [context]);

  return { contacts, whatsappLinks, loading };
}

/** Bust in-memory cache after admin saves (optional). */
export function clearPublicSiteContactsCache() {
  cache.clear();
}
