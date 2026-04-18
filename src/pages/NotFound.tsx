import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ArrowRight } from "lucide-react";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";

const C = { deepEmerald: "#0B3D2E", accent: "#1ABC9C", mint: "#5FFFD7" };

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.deepEmerald }}>
      <Helmet>
        <title>Page not found — Veloxis</title>
        <meta name="robots" content="noindex" />
        <meta name="description" content="The page you are looking for does not exist. Return to the Veloxis homepage." />
      </Helmet>

      <nav className="flex items-center justify-between px-8 py-4" style={{ borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}>
        <Link to="/" className="flex items-center"><img src={veloxisLogoWhite} alt="Veloxis" className="h-9 w-auto" /></Link>
        <div className="hidden md:flex items-center gap-6 text-[13px] text-white/50">
          <Link to="/" className="hover:text-white">Home</Link>
          <Link to="/apply/exporter" className="hover:text-white">Apply</Link>
          <Link to="/login" className="hover:text-white">Log in</Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-[560px] text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold tracking-wider text-[#5FFFD7]" style={{ background: "rgba(26,188,156,0.12)", border: "1px solid rgba(26,188,156,0.3)" }}>
            404
          </span>
          <h1 className="mt-5 text-[42px] font-semibold leading-[1.15] tracking-[-0.01em] text-white">
            This route isn't funded yet.
          </h1>
          <p className="mt-4 text-[15px] leading-[1.6] text-white/55">
            The page you're looking for doesn't exist or has moved. Let's get you back to something useful.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#1ABC9C] hover:bg-[#16a085] px-6 py-3 text-[14px] font-semibold text-white transition-colors">
              Back to home <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="mailto:hello@veloxis.co.uk" className="inline-flex items-center rounded-[10px] px-6 py-3 text-[14px] font-semibold text-white/90 hover:bg-white/5 transition-colors" style={{ border: "1px solid rgba(26,188,156,0.35)" }}>
              Talk to us
            </a>
          </div>
          <p className="mt-8 text-[12px] text-white/30">
            Error code: 404 · If you reached this from a Veloxis email, reply and we'll resolve it.
          </p>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
