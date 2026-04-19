import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet";
import { ArrowRight } from "lucide-react";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";

const C = { deepEmerald: "#0B3D2E", darkTeal: "#0E5A47", accent: "#1ABC9C", mint: "#5FFFD7" };

export default function BrandedNotFound() {
  const location = useLocation();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("404: route not found", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.deepEmerald }}>
      <Helmet>
        <title>Page not found — Veloxis</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Persistent nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-8 py-3 backdrop-blur-md"
        style={{ background: "rgba(11,61,46,0.85)", borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}
      >
        <Link to="/" className="cursor-pointer flex items-center gap-0">
          <img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-[13px] font-medium text-white/50 hover:text-white transition-colors">
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

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-[640px] w-full text-center" style={{ marginTop: "-4vh" }}>
          <span
            className="inline-flex items-center text-[11px] font-semibold tracking-[0.18em] uppercase mb-6 px-3 py-1 rounded-full"
            style={{ background: "rgba(26,188,156,0.10)", border: "1px solid rgba(26,188,156,0.25)", color: C.mint }}
          >
            404
          </span>
          <h1 className="text-[42px] md:text-[52px] font-semibold leading-[1.1] tracking-[-0.02em] text-white mb-5">
            This route isn't funded yet.
          </h1>
          <p className="text-[16px] leading-[1.65] text-white/60 max-w-[480px] mx-auto mb-8">
            The page you're looking for doesn't exist, or it has moved. Let's get you back to something useful.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-1.5 gradient-veloxis-btn text-white font-semibold text-[15px] px-7 py-[14px] rounded-[14px] transition-all duration-200 glow-mint-hover"
            >
              Go home <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="mailto:hello@veloxis.co.uk"
              className="inline-flex items-center justify-center text-white font-semibold text-[15px] px-7 py-[14px] rounded-[14px] border border-[#1ABC9C]/30 hover:bg-[#1ABC9C]/10 transition-all duration-200"
              style={{ background: "rgba(26,188,156,0.06)" }}
            >
              Talk to us
            </a>
          </div>
          <p className="text-[12px] text-white/30 mt-8">
            Error code: 404 · If you reached this from a Veloxis email, reply and we'll resolve it.
          </p>
        </div>
      </main>

      <footer
        className="px-8 py-4 text-center"
        style={{ background: "#071f1d", borderTop: "0.5px solid rgba(26,188,156,0.08)" }}
      >
        <p className="text-[12px] text-white/30">
          © 2026 Veloxis Ltd (Company number 15663333). Registered in England and Wales.
        </p>
      </footer>
    </div>
  );
}
