import { Link } from "react-router-dom";

const PRODUCT = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Why Veloxis", href: "/why-veloxis" },
  { label: "FAQ", href: "/faq" },
];

const COMPANY = [
  { label: "Partners", href: "/partners" },
  { label: "Contact", href: "mailto:hello@veloxis.co.uk" },
];

const LEGAL = [
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms and conditions", href: "/terms" },
  { label: "Disclosure", href: "/disclosure" },
  { label: "Cookies", href: "/cookies" },
];

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6b7280] mb-[14px]">{title}</h4>
      <div className="space-y-2">
        {links.map((link) =>
          link.href.startsWith("mailto:") ? (
            <a
              key={link.href}
              href={link.href}
              className="block text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors"
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.href}
              to={link.href}
              className="block text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors"
            >
              {link.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#f9fafb]" style={{ borderTop: "0.5px solid #e5e7eb" }}>
      <div className="mx-auto max-w-[960px] px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="text-[17px] font-medium text-[#111827] cursor-pointer">Veloxis</Link>
            <p className="mt-2.5 text-[13px] leading-[1.6] text-[#6b7280]">
              UK-based commercial factoring for cross-border export trade finance. Advancing 80% of export invoice value within 24 hours for commodity exporters worldwide shipping to UK and EU buyers.
            </p>
            <a href="mailto:hello@veloxis.co.uk" className="mt-3 block text-[13px] text-[#6b7280] hover:text-[#111827]">
              hello@veloxis.co.uk
            </a>
          </div>

          <FooterColumn title="Product" links={PRODUCT} />
          <FooterColumn title="Company" links={COMPANY} />
          <FooterColumn title="Legal" links={LEGAL} />
        </div>

        <div className="mt-6 pt-5 text-[12px] leading-[1.6] text-[#6b7280] space-y-1" style={{ borderTop: "0.5px solid #e5e7eb" }}>
          <div>© 2026 Veloxis Ltd (Company number 15663333). Registered in England and Wales.</div>
          <div>Registered office: Exeter Business Park, 1 Emperor Way, Exeter, EX1 3QS, United Kingdom.</div>
        </div>
      </div>
    </footer>
  );
}
