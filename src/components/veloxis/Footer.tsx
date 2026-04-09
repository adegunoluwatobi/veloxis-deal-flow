import { Link } from "react-router-dom";

const LINKS = {
  Product: [
    { label: "How It Works", href: "/how-it-works" },
    { label: "Why Veloxis", href: "/why-veloxis" },
    { label: "Partners", href: "/partners" },
    { label: "FAQ", href: "/faq" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Disclosure", href: "/disclosure" },
    { label: "Cookies", href: "/cookies" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-600 to-teal-500 flex items-center justify-center">
                <span className="text-sm font-bold text-primary-foreground">V</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">Veloxis</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              UK-based cross-border invoice discounting platform. Advancing up to 80% of export invoice value within 24 hours.
            </p>
            <p className="text-sm text-muted-foreground mt-4">hello@veloxis.com</p>
          </div>

          {Object.entries(LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-sm font-semibold text-foreground mb-4">{heading}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Veloxis Ltd. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Veloxis Ltd is registered in England and Wales.
          </p>
        </div>
      </div>
    </footer>
  );
}
