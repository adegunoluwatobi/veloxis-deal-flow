import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Why Veloxis", href: "/why-veloxis" },
  { label: "Partners", href: "/partners" },
  { label: "FAQ", href: "/faq" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: "0.5px solid #e5e7eb" }}>
      <div className="mx-auto flex h-14 max-w-[960px] items-center justify-between px-8">
        <Link to="/" className="cursor-pointer text-[17px] font-medium text-[#111827] hover:opacity-80 transition-opacity">
          Veloxis
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/login" className="text-[13px] text-[#6b7280] hover:text-[#111827] transition-colors">
            Log in
          </Link>
          <Link
            to="/contact"
            className="text-[12px] font-medium text-white bg-[#0d9488] hover:bg-[#0f766e] transition-colors rounded-[8px] px-[18px] py-[8px]"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
