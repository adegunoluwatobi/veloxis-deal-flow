import { Link } from "react-router-dom";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";

const NAV_LINKS = [
  { label: "How it works", href: "/#hiw" },
  { label: "Why Veloxis", href: "/#why" },
  { label: "Partners", href: "/#partners" },
  { label: "FAQ", href: "/#faq" },
];

export function Navbar() {
  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-8 py-3 backdrop-blur-md"
      style={{
        background: "rgba(11,61,46,0.85)",
        borderBottom: "0.5px solid rgba(26,188,156,0.12)",
      }}
    >
      <Link to="/" className="cursor-pointer flex items-center gap-0">
        <img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" />
      </Link>

      <div className="hidden md:flex items-center gap-8">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className="text-[13px] font-medium text-white/50 hover:text-[#5FFFD7] transition-colors tracking-[-0.01em]"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Link
          to="/login"
          className="text-[13px] font-medium text-white/50 hover:text-white transition-colors"
        >
          Log in
        </Link>
        <Link
          to="/apply/exporter"
          className="gradient-veloxis-btn text-white text-[13px] font-semibold px-5 py-2.5 rounded-[10px] transition-all duration-200 glow-mint-hover"
        >
          Get started
        </Link>
      </div>
    </nav>
  );
}
