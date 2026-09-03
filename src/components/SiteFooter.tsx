import { Phone, Mail, MapPin, Instagram, Youtube, Linkedin, Facebook } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { usePublicSiteContacts } from "@/hooks/usePublicSiteContacts";
import type { SiteContactDetail } from "@/lib/siteContacts";

const FALLBACK_ADDRESS =
  "Arfabad Colony, East Nahar Road, Bajrangpuri, Patna - 800007, Bihar";
const FALLBACK_PHONES = [{ label: "Phone", value: "+91 70509 36593", href: "tel:+917050936593" }];
const FALLBACK_EMAILS = [
  { label: "Contact", value: "contact@ezyintern.in", href: "mailto:contact@ezyintern.in" },
  { label: "Support", value: "support@ezyintern.in", href: "mailto:support@ezyintern.in" },
];
const FALLBACK_SOCIAL = [
  { icon: "youtube" as const, href: "https://www.youtube.com/@Ezyintern_Internship", label: "YouTube" },
  { icon: "linkedin" as const, href: "https://www.linkedin.com/company/ezyintern1/", label: "LinkedIn" },
];

function socialIcon(iconKey: string | null | undefined, href: string) {
  const lower = (iconKey || href).toLowerCase();
  if (lower.includes("youtube")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors" aria-label="YouTube">
        <Youtube className="size-5" />
      </a>
    );
  }
  if (lower.includes("linkedin")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors" aria-label="LinkedIn">
        <Linkedin className="size-5" />
      </a>
    );
  }
  if (lower.includes("instagram")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors" aria-label="Instagram">
        <Instagram className="size-5" />
      </a>
    );
  }
  if (lower.includes("facebook")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors" aria-label="Facebook">
        <Facebook className="size-5" />
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors text-xs font-bold">
      {iconKey || "Link"}
    </a>
  );
}

function partitionContacts(contacts: SiteContactDetail[]) {
  const addresses = contacts.filter((c) => c.contact_type === "address");
  const phones = contacts.filter((c) => c.contact_type === "phone");
  const emails = contacts.filter((c) => c.contact_type === "email");
  const socials = contacts.filter((c) => c.contact_type === "social");
  const others = contacts.filter((c) => c.contact_type === "other");
  return { addresses, phones, emails, socials, others };
}

export const SiteFooter = () => {
  const { contacts } = usePublicSiteContacts("footer");
  const { addresses, phones, emails, socials } = partitionContacts(contacts);

  const addressText = addresses[0]?.value || FALLBACK_ADDRESS;
  const phoneRows =
    phones.length > 0
      ? phones.map((p) => ({ label: p.label, value: p.value, href: p.href || `tel:${p.value.replace(/\s/g, "")}` }))
      : FALLBACK_PHONES;
  const emailRows =
    emails.length > 0
      ? emails.map((e) => ({ label: e.label, value: e.value, href: e.href || `mailto:${e.value}` }))
      : FALLBACK_EMAILS;
  const socialRows =
    socials.length > 0
      ? socials.map((s) => ({ icon: s.icon, href: s.href || s.value, label: s.label }))
      : FALLBACK_SOCIAL;

  return (
    <footer id="footer" className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-[1200px] px-8 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <Link to="/" className="inline-flex w-fit rounded-xl bg-white px-3 py-2">
                <BrandLogo size="md" />
              </Link>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              India&apos;s trusted platform for UGC-compliant internship programmes, digital certification, and academic credit tracking.
            </p>
            <div className="flex gap-4 flex-wrap">
              {socialRows.map((s, i) => (
                <span key={`${s.href}-${i}`}>{socialIcon(s.icon, s.href)}</span>
              ))}
              {socialRows.length === 0 && (
                <>
                  <a href="#" className="hover:text-primary transition-colors" aria-label="Instagram"><Instagram className="size-5" /></a>
                  <a href="#" className="hover:text-primary transition-colors" aria-label="Facebook"><Facebook className="size-5" /></a>
                </>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-white mb-6">Quick Links</h4>
            <ul className="space-y-3.5 text-sm">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><a href="/#about" className="hover:text-white transition-colors">About</a></li>
              <li><a href="/#gallery" className="hover:text-white transition-colors">Gallery</a></li>
              <li><a href="/blog" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="/#consent-form" className="hover:text-white transition-colors">Consent Form</a></li>
              <li><a href="/#faq" className="hover:text-white transition-colors">FAQ</a></li>
              <li><Link to="/verify" className="hover:text-white transition-colors">Verify Certificate</Link></li>
              <li><Link to="/cybercafe" className="hover:text-white transition-colors font-semibold text-[#5ea4e8]">Cyber Cafe Partner</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-white mb-6">For Students</h4>
            <ul className="space-y-3.5 text-sm">
              <li><Link to="/register" className="hover:text-white transition-colors font-bold text-primary">Register Now</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Student Login</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Help & Support</Link></li>
              <li><Link to="/benefits" className="hover:text-white transition-colors">Program Benefits</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-white mb-6">Contact Us</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="size-5 mt-0.5 text-primary flex-shrink-0" />
                <span className="whitespace-pre-line">{addressText}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="size-5 text-primary flex-shrink-0" />
                <div className="flex flex-col">
                  {phoneRows.map((p) => (
                    <a key={p.href} href={p.href} className="hover:text-white">
                      {p.value}
                    </a>
                  ))}
                </div>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="size-5 text-primary flex-shrink-0" />
                <div className="flex flex-col">
                  {emailRows.map((e) => (
                    <a key={e.href} href={e.href} className="hover:text-white">
                      {e.value}
                    </a>
                  ))}
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <p>© {new Date().getFullYear()} Apna Intern. Government Certified Provider.</p>
          <div className="flex gap-8">
            <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
