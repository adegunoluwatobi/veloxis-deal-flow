import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Clock,
  XCircle,
  TrendingUp,
  MapPin,
  FileText,
  Search,
  Shield,
  DollarSign,
  Globe,
  Users,
  CheckCircle,
  ChevronDown,
  ArrowRight,
  Loader2,
} from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string;
  a: string;
}

// ─── ICON MAP ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  clock: Clock,
  "x-circle": XCircle,
  "trending-up": TrendingUp,
  "map-pin": MapPin,
  "file-text": FileText,
  search: Search,
  shield: Shield,
  "dollar-sign": DollarSign,
  globe: Globe,
  users: Users,
};

function IconByName({ name, className }: { name: string; className?: string }) {
  const Comp = ICON_MAP[name] || FileText;
  return <Comp className={className} />;
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const faqs: FaqItem[] = [
  {
    q: "What is invoice discounting?",
    a: "Invoice discounting is trade finance where a financier advances cash against an unpaid invoice. Unlike a loan, there is no debt on your balance sheet. Veloxis purchases your receivable at a discount — you get cash now, we collect from your buyer at maturity. Your buyer signs a legal payment undertaking directly with Veloxis before any funds are released.",
  },
  {
    q: "Who can use Veloxis?",
    a: "Veloxis is for incorporated businesses anywhere in the world that export non-agricultural, non-perishable goods to verified buyers in the UK or European Economic Area. You must be onboarded through a Veloxis-approved local partner. Sole traders and unregistered partnerships are not eligible.",
  },
  {
    q: "What is an Irrevocable Payment Undertaking (IPU)?",
    a: "The IPU is the legal instrument at the heart of every Veloxis transaction. Before funds are released, your buyer signs a formal undertaking committing to pay Veloxis directly on the invoice due date. No signed IPU means no funds released — it is the core protection for all parties.",
  },
  {
    q: "How long does approval take?",
    a: "A complete application — all documents uploaded, KYC verified by your partner, buyer details confirmed — is reviewed within 24 hours. Once your buyer signs the IPU, funds are released typically within the same business day.",
  },
  {
    q: "Do I need a UK bank account?",
    a: "No. Veloxis settles funds directly to your domiciliary account in your home country. You do not need a UK or EU bank account. This is one of the key reasons the platform was built.",
  },
  {
    q: "What goods are eligible?",
    a: "Eligible: solid minerals, metals and scrap, manufactured goods, textiles, processed chemicals (non-hazardous), timber and wood products, processed seafood. Not eligible: raw agricultural produce, live animals, perishables, weapons, and controlled substances.",
  },
  {
    q: "Is Veloxis a lender?",
    a: "No. Veloxis is an invoice discounting platform — we purchase your receivable at a discount. We are buying an asset, not extending a loan. No debt on your balance sheet and no loan agreement to service.",
  },
  {
    q: "Can I submit multiple invoices?",
    a: "Yes. Once your KYC is verified and your profile is set up, subsequent deals are significantly faster. Many exporters use Veloxis on a rolling basis across multiple buyers and shipment cycles.",
  },
];

const problems = [
  {
    icon: "clock",
    title: "Waiting 30–60 days for payment",
    body: "You ship goods and wait months to be paid while still covering suppliers, staff, logistics, and overheads.",
  },
  {
    icon: "x-circle",
    title: "Banks reject emerging market exporters",
    body: "Overseas buyers, foreign currency receivables, no UK collateral — traditional lenders decline this segment every time.",
  },
  {
    icon: "trending-up",
    title: "Cash flow gaps stall growth",
    body: "New orders get rejected. Supplier relationships break down. Growth stalls — not because of demand, but because of payment timing.",
  },
  {
    icon: "map-pin",
    title: "No domiciliary account settlement",
    body: "Most finance platforms route funds through UK accounts you don't control. Your money should arrive where your business operates.",
  },
];

const howItWorksSteps = [
  {
    icon: "file-text",
    title: "Submit",
    body: "Partner verifies your KYC. Upload your commercial invoice, Bill of Lading, and buyer details through the secure portal.",
  },
  {
    icon: "search",
    title: "We underwrite",
    body: "Our team verifies documents, assesses buyer risk, and completes compliance checks within 24 hours.",
  },
  {
    icon: "shield",
    title: "Buyer signs IPU",
    body: "Your buyer signs an Irrevocable Payment Undertaking digitally, committing to pay Veloxis on the due date.",
  },
  {
    icon: "dollar-sign",
    title: "Funds released",
    body: "80% wired to your domiciliary account immediately. Buyer pays at maturity. We send you the residual balance.",
  },
];

const whyCards = [
  {
    kicker: "Zero",
    kicker_label: "Assets pledged",
    title: "No collateral. Ever.",
    body: "We finance your receivable — not your balance sheet. No property, no equipment, no personal guarantees. If the invoice is real and the buyer is verified, it qualifies.",
    icon: "shield",
    color: "#0d9488",
    large: true,
  },
  {
    kicker: "24 hrs",
    kicker_label: "Credit decision",
    title: "Faster than any bank.",
    body: "Submit today. Receive a decision tomorrow. No credit committees, no branch visits, no weeks of waiting.",
    icon: "clock",
    color: "#0f766e",
    large: true,
  },
  {
    kicker: "Your account",
    kicker_label: "In your country",
    title: "No UK bank needed",
    body: "Funds go directly to your domiciliary account. No forced FX conversion, no accounts you don't control.",
    icon: "globe",
    color: "#14b8a6",
    large: false,
  },
  {
    kicker: "Legally",
    kicker_label: "Secured",
    title: "IPU-backed transactions",
    body: "Your buyer signs an Irrevocable Payment Undertaking before any funds leave Veloxis. Binding and enforceable.",
    icon: "file-text",
    color: "#0d9488",
    large: false,
  },
  {
    kicker: "Local",
    kicker_label: "Partner network",
    title: "Guided from day one",
    body: "Local KYC partners handle your onboarding in your language and timezone. You are never navigating alone.",
    icon: "users",
    color: "#0f766e",
    large: false,
  },
];

const testimonials = [
  {
    flag: "🇳🇬",
    name: "Adebayo O.",
    role: "Solid minerals exporter, Nigeria",
    quote:
      "We shipped to our German buyer in February and needed cash for our March order. Veloxis had funds in our account within 24 hours of the IPU being signed. We have not missed an order since.",
  },
  {
    flag: "🇬🇭",
    name: "Fatima K.",
    role: "Textile exporter, Ghana",
    quote:
      "Our partner handled the documents. Veloxis handled the underwriting. We tracked the status on the portal and confirmed receipt when the residual arrived.",
  },
  {
    flag: "🇰🇪",
    name: "Emmanuel N.",
    role: "Manufactured goods exporter, Kenya",
    quote:
      "Finally a UK-based platform that understands cross-border trade. The buyer signs, the money moves. No guessing, no chasing, no delays.",
  },
  {
    flag: "🇳🇬",
    name: "Chidi A.",
    role: "Trade finance partner, Nigeria",
    quote:
      "I refer exporters to Veloxis with full confidence. The process is transparent and clients always know exactly where their application stands.",
  },
];

const problemPills = [
  "Waiting 30–60 days for payment",
  "Banks reject emerging market exporters",
  "No UK collateral to secure finance",
  "FX conversion costs eating margins",
  "Cash flow gaps stall growth",
  "No UK bank account for settlement",
  "Complex document requirements",
  "Buyer payment risk with no recourse",
];

const solutionPills = [
  "80% advance in your account within 24 hours",
  "Zero collateral required",
  "Domiciliary account settlement",
  "Buyer-signed IPU for legal certainty",
  "Partner-led KYC in your country",
  "24-hour credit decision",
  "No UK bank account needed",
  "No FX conversion on your advance",
];

// ─── TYPING HEADLINE ─────────────────────────────────────────────────────────

function TypingHeadline() {
  const line1 = "You've shipped the goods.";
  const line2 = "Get paid now.";
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<"line1" | "line2" | "pause">("line1");
  const idx = useRef(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "line1") {
      if (idx.current < line1.length) {
        timeout = setTimeout(() => {
          setDisplayed(line1.slice(0, idx.current + 1));
          idx.current++;
        }, 55);
      } else {
        timeout = setTimeout(() => {
          idx.current = 0;
          setPhase("line2");
        }, 200);
      }
    } else if (phase === "line2") {
      if (idx.current < line2.length) {
        timeout = setTimeout(() => {
          setDisplayed(line1 + "\n" + line2.slice(0, idx.current + 1));
          idx.current++;
        }, 68);
      } else {
        timeout = setTimeout(() => {
          idx.current = 0;
          setPhase("pause");
        }, 3400);
      }
    } else {
      setDisplayed("");
      timeout = setTimeout(() => {
        setPhase("line1");
      }, 400);
    }

    return () => clearTimeout(timeout);
  }, [displayed, phase]);

  const parts = displayed.split("\n");

  return (
    <h1 className="text-[42px] md:text-[52px] font-semibold leading-[1.1] text-white min-h-[130px]">
      {parts[0]}
      {parts.length > 1 && (
        <>
          <br />
          <span className="text-[#14b8a6]">{parts[1]}</span>
        </>
      )}
      <span className="inline-block w-[3px] h-[1em] bg-[#14b8a6] ml-1 align-text-bottom animate-blink" />
    </h1>
  );
}

// ─── TICKER ROW ───────────────────────────────────────────────────────────────

function TickerRow({
  items,
  direction,
  variant,
}: {
  items: string[];
  direction: "left" | "right";
  variant: "problem" | "solution";
}) {
  const doubled = [...items, ...items];
  const animClass = direction === "left" ? "animate-ticker-left" : "animate-ticker-right";
  const pillStyle =
    variant === "problem"
      ? "bg-white/[0.08] border-white/[0.12] text-white/60"
      : "bg-[#14b8a6]/20 border-[#14b8a6]/30 text-[#14b8a6]";

  return (
    <div className="relative overflow-hidden group">
      {/* Edge masks */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-[#0f3530] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-[#0f3530] to-transparent" />
      <div className={`flex gap-3 w-max ${animClass} group-hover:[animation-play-state:paused]`}>
        {doubled.map((text, i) => (
          <span
            key={i}
            className={`inline-flex items-center px-4 py-2 rounded-full border text-[13px] whitespace-nowrap ${pillStyle}`}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── COMPARISON ANIMATION ────────────────────────────────────────────────────

const compSteps = [
  "Documents verified",
  "Deal approved",
  "Buyer signs IPU",
  "Funds released",
];

function ComparisonAnimation() {
  const [stepState, setStepState] = useState<
    ("waiting" | "processing" | "done")[]
  >(["waiting", "waiting", "waiting", "waiting"]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      while (!cancelled) {
        setStepState(["waiting", "waiting", "waiting", "waiting"]);
        await delay(800);
        for (let i = 0; i < 4; i++) {
          if (cancelled) return;
          setStepState((prev) =>
            prev.map((s, j) => (j === i ? "processing" : s))
          );
          await delay(1400);
          if (cancelled) return;
          setStepState((prev) =>
            prev.map((s, j) => (j === i ? "done" : s))
          );
          await delay(400);
        }
        await delay(2800);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[960px] mx-auto">
      {/* Old way */}
      <div className="bg-[#f0eeeb] rounded-2xl p-8">
        <div className="bg-white rounded-xl p-5 border border-[#e5e2dd]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#e5e2dd] text-[#999] text-sm font-medium">
              1
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-medium text-[#333]">Invoice submitted</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Loader2 className="w-3 h-3 text-[#999] animate-spin" />
                <span className="text-[12px] text-[#999]">Bank reviewing…</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#e5e2dd] text-[12px] font-medium text-[#777]">
            Old way
          </span>
          <p className="text-[13px] text-[#999] mt-2">
            Exporters wait weeks. Usually rejected. One step. Stuck.
          </p>
        </div>
      </div>

      {/* With Veloxis */}
      <div className="bg-[#e8f5f1] rounded-2xl p-8">
        <div className="space-y-3">
          {compSteps.map((name, i) => {
            const state = stepState[i];
            const isDone = state === "done";
            const isProc = state === "processing";
            return (
              <div key={i} className="relative">
                {i < 3 && (
                  <div className="absolute left-4 top-9 w-px h-3 bg-[#0d9488]/20" />
                )}
                <div className={`flex items-center gap-3 rounded-xl p-3 transition-colors duration-300 ${isDone ? "bg-[#0d9488]/10" : "bg-white"} border ${isDone ? "border-[#0d9488]/20" : "border-[#d1e8e3]"}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors duration-300 ${isDone ? "bg-[#0d9488] text-white" : isProc ? "bg-[#14b8a6]/20 text-[#0d9488]" : "bg-[#d1e8e3] text-[#6b7280]"}`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-[13px] font-medium ${isDone ? "text-[#0d9488]" : "text-[#333]"}`}>
                      {name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {isProc && <Loader2 className="w-3 h-3 text-[#0d9488] animate-spin" />}
                      <span className={`text-[11px] ${isDone ? "text-[#0d9488]" : isProc ? "text-[#0d9488]" : "text-[#999]"}`}>
                        {isDone ? "Done" : isProc ? "Processing" : "Waiting"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#0d9488]/15 text-[12px] font-medium text-[#0d9488]">
            With Veloxis
          </span>
          <p className="text-[13px] text-[#6b7280] mt-2">
            Four steps. 80% in your account within 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── FAQ ITEM ────────────────────────────────────────────────────────────────

function FaqItemComponent({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-[14px] font-medium text-[#111827] hover:bg-[#f9fafb] transition-colors"
      >
        {item.q}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#6b7280] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-[13px] leading-[1.6] text-[#6b7280]">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function VeloxisWebsite() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white" style={{ scrollBehavior: "smooth" }}>
      {/* ═══ NAV ═══ */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-[#0a2e2b]" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.10)" }}>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="text-[17px] font-medium text-white cursor-pointer"
        >
          Veloxis
        </button>
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "How it works", id: "hiw" },
            { label: "Why Veloxis", id: "why" },
            { label: "Partners", id: "partners" },
            { label: "FAQ", id: "faq" },
          ].map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className="text-[14px] text-white/55 hover:text-white transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-[14px] text-white/55 hover:text-white transition-colors">
            Log in
          </Link>
          <Link
            to="/contact"
            className="bg-[#14b8a6] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#0d9488] transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative bg-[#0a2e2b] overflow-hidden" style={{ minHeight: "max(100vh, 680px)" }}>
        {/* Blobs */}
        <div className="absolute top-[-80px] right-[120px] w-[340px] h-[340px] rounded-full bg-[#0d9488] opacity-[0.18]" />
        <div className="absolute bottom-[40px] right-[60px] w-[220px] h-[220px] rounded-full bg-[#14b8a6] opacity-[0.12]" />
        <div className="absolute top-[200px] left-[-60px] w-[160px] h-[160px] rounded-full bg-[#0d9488] opacity-[0.10]" />

        <div className="relative z-10 mx-auto max-w-[1080px] grid grid-cols-1 md:grid-cols-[55%_45%] items-center gap-12 px-8 py-20 md:py-0" style={{ minHeight: "max(100vh, 680px)" }}>
          {/* Left */}
          <div>
            {/* Pill */}
            <div className="inline-flex items-center gap-2 rounded-full px-[14px] py-[6px] text-[12px] text-white mb-6" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.20)" }}>
              <span className="relative flex h-[6px] w-[6px]">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14b8a6] opacity-75" />
                <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-[#14b8a6]" />
              </span>
              Working capital without borders
              <ArrowRight className="w-3 h-3 text-[#14b8a6]" />
            </div>

            <TypingHeadline />

            <p className="mt-5 max-w-[420px] text-[16px] leading-[1.65] text-white/70">
              Get 80% of your invoice value in your account within 24 hours. No collateral required.
            </p>

            {/* Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-start gap-[14px]">
              <Link
                to="/contact"
                className="inline-flex items-center gap-1.5 bg-[#14b8a6] text-white font-bold text-[15px] px-7 py-[14px] rounded-[14px] hover:bg-[#0d9488] transition-colors"
              >
                Apply now <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => scrollTo("hiw")}
                className="text-white font-semibold text-[15px] px-7 py-[14px] rounded-[14px] hover:bg-white/[0.22] transition-colors"
                style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.40)" }}
              >
                How it works
              </button>
            </div>

            {/* Trust strip */}
            <div className="mt-7 flex flex-wrap gap-5">
              {["UK-Registered", "No Collateral", "24-Hour Decisions", "Domiciliary Settlement"].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] text-white/65">
                  <span className="h-[5px] w-[5px] rounded-full bg-[#14b8a6]" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — browser mockup */}
          <div className="relative flex justify-center">
            {/* Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[300px] h-[300px] rounded-full bg-[#0d9488] opacity-[0.15] blur-[60px]" />
            </div>
            <div className="relative -rotate-[1.5deg] w-full max-w-[440px]" style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
              <div className="bg-[#1a1a2e] rounded-2xl p-3 overflow-hidden">
                {/* Chrome bar */}
                <div className="flex items-center gap-3 bg-[#111] rounded-t-xl px-3 py-2">
                  <div className="flex gap-1.5">
                    <div className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]" />
                    <div className="w-[10px] h-[10px] rounded-full bg-[#ffbd2e]" />
                    <div className="w-[10px] h-[10px] rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 bg-[#222] rounded-md px-3 py-1 text-[11px] text-[#666] text-center">
                    app.veloxis.com
                  </div>
                </div>
                {/* Dashboard */}
                <div className="bg-[#0f1f1d] p-4 space-y-3 rounded-b-xl">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-[14px] font-medium">Good morning, Adebayo 👋</p>
                      <p className="text-[11px] text-white/40">Lagos Metals Ltd · Exporter</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#14b8a6]/30 flex items-center justify-center text-[11px] font-medium text-[#14b8a6]">
                      AO
                    </div>
                  </div>
                  {/* Invoice card */}
                  <div className="bg-[#1a2926] rounded-xl p-3 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Current application</p>
                        <p className="text-[20px] font-semibold text-white mt-0.5">$45,000</p>
                        <p className="text-[11px] text-white/40">Invoice #INV-2026-041 · German buyer</p>
                      </div>
                      <span className="bg-[#14b8a6]/20 text-[#14b8a6] text-[10px] font-medium px-2 py-0.5 rounded-full">
                        IPU Signed
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#0f1f1d] rounded-lg p-2">
                        <p className="text-[10px] text-white/40">You receive</p>
                        <p className="text-[16px] font-semibold text-[#14b8a6]">$36,000</p>
                        <p className="text-[10px] text-white/30">Today, 80% advance</p>
                      </div>
                      <div className="bg-[#0f1f1d] rounded-lg p-2">
                        <p className="text-[10px] text-white/40">Settlement</p>
                        <p className="text-[16px] font-semibold text-white">May 10</p>
                        <p className="text-[10px] text-white/30">30-day terms</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-[#0f1f1d] rounded-full overflow-hidden">
                      <div className="h-full w-[80%] bg-[#14b8a6] rounded-full" />
                    </div>
                    <div className="flex justify-between text-[10px] text-white/30">
                      <span>80% advanced</span>
                      <span>20% on settlement</span>
                    </div>
                  </div>
                  {/* Steps */}
                  <div className="flex items-center gap-3">
                    <div className="bg-[#14b8a6]/15 rounded-lg px-3 py-2 flex-1">
                      <p className="text-[10px] text-white/40">Step 3 of 4</p>
                      <p className="text-[12px] font-medium text-[#14b8a6]">IPU Signed ✓</p>
                    </div>
                    <div className="bg-[#1a2926] rounded-lg px-3 py-2 flex-1">
                      <p className="text-[10px] text-white/40">Next</p>
                      <p className="text-[12px] font-medium text-white">Funds Released</p>
                    </div>
                  </div>
                  {/* Activity */}
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Activity</p>
                    {[
                      { color: "#4ade80", text: "Buyer signed IPU", time: "2h ago" },
                      { color: "#4ade80", text: "Deal approved by Veloxis", time: "Yesterday" },
                      { color: "#fbbf24", text: "Funds release pending", time: "Today" },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-2 py-1.5 border-t border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.color }} />
                        <span className="text-[11px] text-white/60 flex-1">{row.text}</span>
                        <span className="text-[10px] text-white/30">{row.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="bg-[#f0fdf9] py-6" style={{ borderBottom: "0.5px solid #e5e7eb" }}>
        <div className="mx-auto max-w-[780px] grid grid-cols-2 md:grid-cols-4 gap-6 px-8 text-center">
          {[
            { v: "80%", l: "Advanced on day one" },
            { v: "24hrs", l: "From approval to funds" },
            { v: "30–60", l: "Day payment terms" },
            { v: "UK & EU", l: "Buyer destination markets" },
          ].map((s) => (
            <div key={s.v}>
              <p className="text-[28px] font-medium text-[#0d9488]">{s.v}</p>
              <p className="text-[12px] text-[#6b7280] mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PROBLEM SECTION (dark) ═══ */}
      <section className="bg-[#0a2e2b] py-16">
        <div className="mx-auto max-w-[960px] px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#14b8a6] mb-2">The problem</p>
          <h2 className="text-[34px] font-medium leading-[1.2] text-white">
            You've shipped.<br />Why are you still waiting?
          </h2>
          <p className="mt-3 max-w-[520px] text-[14px] leading-[1.6] text-white/50">
            The invoice exists. The buyer is real. The goods are gone. The problem is the 60 days in between.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {problems.map((p) => (
              <div key={p.title} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.10)" }}>
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#14b8a6]/15 mb-4">
                  <IconByName name={p.icon} className="w-5 h-5 text-[#14b8a6]" />
                </div>
                <h3 className="text-[15px] font-medium text-white mb-2">{p.title}</h3>
                <p className="text-[13px] leading-[1.6] text-white/45">{p.body}</p>
              </div>
            ))}
          </div>

          {/* Solution banner */}
          <div className="mt-6 rounded-2xl p-6 flex flex-col md:flex-row items-start gap-5" style={{ background: "rgba(20,184,166,0.12)", border: "0.5px solid rgba(20,184,166,0.25)" }}>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#14b8a6]/20 shrink-0">
              <Shield className="w-6 h-6 text-[#14b8a6]" />
            </div>
            <div>
              <h3 className="text-[16px] font-medium text-white mb-2">Veloxis solves all of this in one platform.</h3>
              <p className="text-[13px] text-white/50 leading-[1.6] mb-3">
                Once approved and your buyer signs the IPU, 80% of your invoice is in your domiciliary account within 24 hours. No collateral. No UK bank needed.
              </p>
              <div className="flex flex-wrap gap-3">
                {["80% advance within 24hrs", "Zero collateral", "Domiciliary settlement", "IPU-backed legally"].map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 text-[12px] text-[#14b8a6]">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TICKER ═══ */}
      <section className="bg-[#0f3530] py-16 overflow-hidden">
        <div className="mx-auto max-w-[960px] px-8 text-center mb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#14b8a6] mb-2">Built for your problems</p>
          <h2 className="text-[34px] font-medium leading-[1.2] text-white">Every barrier exporters face. Solved.</h2>
          <p className="mt-3 max-w-[520px] mx-auto text-[14px] leading-[1.6] text-white/50">
            Traditional finance was built for domestic markets. Veloxis was built for cross-border export discounting.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/30 mb-3 px-8">The challenges</p>
            <TickerRow items={problemPills} direction="left" variant="problem" />
          </div>
          <div className="h-px bg-white/5" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#14b8a6]/60 mb-3 px-8">The Veloxis solution</p>
            <TickerRow items={solutionPills} direction="right" variant="solution" />
          </div>
        </div>
      </section>

      {/* ═══ COMPARISON ═══ */}
      <section className="py-16 px-8" style={{ background: "#f8f8f6" }}>
        <div className="text-center mb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#6b7280] mb-2">The shift</p>
          <h2 className="text-[28px] font-medium text-[#6b7280]">Banks gave you waiting.</h2>
          <h2 className="text-[34px] font-medium text-[#111827]">Veloxis gives you working capital.</h2>
        </div>
        <ComparisonAnimation />
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="hiw" className="bg-[#0a2e2b] py-16">
        <div className="mx-auto max-w-[960px] px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#14b8a6] mb-2">How it works</p>
          <h2 className="text-[34px] font-medium leading-[1.2] text-white">
            From invoice to funds.<br />Four steps.
          </h2>
          <p className="mt-3 max-w-[480px] text-[14px] leading-[1.6] text-white/50">
            Built for cross-border trade — not adapted from a domestic template.
          </p>

          <div className="mt-10 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-[calc(12.5%)] right-[calc(12.5%)] h-px bg-[#14b8a6]/20" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {howItWorksSteps.map((step, i) => (
                <div key={i} className="text-center relative">
                  <div className="mx-auto w-16 h-16 rounded-full bg-[#14b8a6] flex items-center justify-center mb-4 relative z-10">
                    <IconByName name={step.icon} className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-[15px] font-medium text-white mb-2">{step.title}</h3>
                  <p className="text-[13px] leading-[1.6] text-white/45">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHY VELOXIS ═══ */}
      <section id="why" className="bg-white py-16" style={{ borderTop: "0.5px solid #e5e7eb" }}>
        <div className="mx-auto max-w-[960px] px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">Why Veloxis</p>
          <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
            Built for this trade.<br />Not retrofitted for it.
          </h2>
          <p className="mt-3 max-w-[520px] text-[14px] leading-[1.6] text-[#6b7280]">
            Every feature exists because of the specific barriers exporters in emerging markets face when accessing working capital.
          </p>

          {/* Row 1 — large cards */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {whyCards.filter((c) => c.large).map((card) => (
              <div
                key={card.title}
                className="relative overflow-hidden rounded-2xl bg-white p-[26px] transition-all duration-200 hover:-translate-y-[3px] hover:border-[#0d9488] group"
                style={{ border: "1px solid #e5e7eb" }}
              >
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: card.color }} />
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f0fdfa]">
                  <IconByName name={card.icon} className="h-6 w-6 text-[#0d9488]" />
                </div>
                <div className="text-[28px] font-medium text-[#0d9488]">{card.kicker}</div>
                <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#6b7280] mb-2.5">{card.kicker_label}</div>
                <h3 className="text-[16px] font-medium text-[#111827] mb-2">{card.title}</h3>
                <p className="text-[13px] leading-[1.6] text-[#6b7280]">{card.body}</p>
              </div>
            ))}
          </div>

          {/* Row 2 — standard cards */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {whyCards.filter((c) => !c.large).map((card) => (
              <div
                key={card.title}
                className="relative overflow-hidden rounded-2xl bg-white p-[26px] transition-all duration-200 hover:-translate-y-[3px] hover:border-[#0d9488] group"
                style={{ border: "1px solid #e5e7eb" }}
              >
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: card.color }} />
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f0fdfa]">
                  <IconByName name={card.icon} className="h-6 w-6 text-[#0d9488]" />
                </div>
                <div className="text-[22px] font-medium text-[#0d9488]">{card.kicker}</div>
                <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#6b7280] mb-2.5">{card.kicker_label}</div>
                <h3 className="text-[16px] font-medium text-[#111827] mb-2">{card.title}</h3>
                <p className="text-[13px] leading-[1.6] text-[#6b7280]">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PARTNERS ═══ */}
      <section id="partners" className="py-16 px-8" style={{ background: "#f8f8f6" }}>
        <div className="mx-auto max-w-[960px] text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">For partners</p>
          <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
            Your exporters need working capital.<br />We provide it.
          </h2>
          <p className="mx-auto mt-3 max-w-[480px] text-[14px] leading-[1.6] text-[#6b7280]">
            Veloxis works with trusted local partners — finance companies, trade associations, and origination networks.
          </p>

          <div className="mt-8 bg-[#0a2e2b] rounded-2xl p-6 md:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { num: "01", icon: "users", title: "Onboard", body: "Register exporters on Veloxis. Handle local KYC using our structured document system. You know the market — we give you the tools." },
                { num: "02", icon: "dollar-sign", title: "We fund", body: "Veloxis underwrites buyer risk, generates the IPU, and wires the advance. You focus on origination. We handle compliance and settlement." },
                { num: "03", icon: "trending-up", title: "You grow", body: "Build a sustainable export financing pipeline. Every funded deal deepens the relationship between your network and the platform." },
              ].map((card) => (
                <div key={card.num} className="rounded-xl p-5 text-left" style={{ background: "rgba(255,255,255,0.06)", borderTop: "3px solid #14b8a6" }}>
                  <p className="text-[28px] font-medium text-white/15 leading-none mb-3">{card.num}</p>
                  <div className="w-9 h-9 rounded-lg bg-[#14b8a6]/15 flex items-center justify-center mb-3">
                    <IconByName name={card.icon} className="w-4 h-4 text-[#14b8a6]" />
                  </div>
                  <h3 className="text-[15px] font-medium text-white mb-2">{card.title}</h3>
                  <p className="text-[13px] leading-[1.6] text-white/45">{card.body}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: "rgba(20,184,166,0.12)" }}>
              <div className="text-left">
                <p className="text-[15px] font-medium text-white">Ready to become a Veloxis partner?</p>
                <p className="text-[13px] text-white/50">Bring your exporters. We handle the rest.</p>
              </div>
              <Link
                to="/partners"
                className="inline-flex items-center gap-1.5 bg-[#14b8a6] text-white text-[14px] font-medium px-6 py-3 rounded-[14px] hover:bg-[#0d9488] transition-colors whitespace-nowrap"
              >
                Become a partner <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="bg-[#f9fafb] py-16">
        <div className="mx-auto max-w-[960px] px-8 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">What exporters say</p>
          <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
            From the corridor we serve.
          </h2>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-[14px] text-left">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-[14px] bg-white p-[22px]"
                style={{ border: "0.5px solid #e5e7eb" }}
              >
                <p className="text-[13px] text-[#f59e0b] mb-2">★★★★★</p>
                <p className="text-[13px] italic leading-[1.6] text-[#6b7280] mb-[14px]">
                  "{t.quote}"
                </p>
                <div className="text-[13px] font-medium text-[#111827]">{t.flag} {t.name}</div>
                <div className="text-[12px] text-[#6b7280]">{t.role}</div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-[11px] text-[#6b7280]">
            Testimonials are illustrative. Individual results vary based on invoice value, buyer terms, and underwriting outcome.
          </p>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="bg-white py-16">
        <div className="mx-auto max-w-[960px] px-8 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">FAQ</p>
          <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
            Everything you need to know.
          </h2>
          <p className="mt-3 text-[14px] text-[#6b7280] mb-7">
            Still have questions?{" "}
            <a href="mailto:hello@veloxis.com" className="text-[#0d9488] hover:underline">hello@veloxis.com</a>
          </p>

          <div className="text-left space-y-2">
            {faqs.map((item, i) => (
              <FaqItemComponent
                key={i}
                item={item}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative bg-[#0a2e2b] py-[60px] overflow-hidden">
        <div className="absolute top-[-40px] right-[80px] w-[200px] h-[200px] rounded-full bg-[#14b8a6] opacity-[0.10]" />
        <div className="relative z-10 mx-auto max-w-[960px] px-8 text-center">
          <h2 className="text-[34px] font-medium text-white">
            Your invoice is an asset.<br />Start using it.
          </h2>
          <p className="mx-auto mt-3 mb-[26px] max-w-[440px] text-[15px] text-[#99f6e4]/80">
            Join exporters from emerging markets worldwide growing faster because they are not waiting 60 days to be paid.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/contact"
              className="inline-flex items-center gap-1.5 bg-[#14b8a6] text-white font-bold text-[15px] px-7 py-[14px] rounded-[14px] hover:bg-[#0d9488] transition-colors"
            >
              Apply now <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contact"
              className="text-white font-semibold text-[15px] px-7 py-[14px] rounded-[14px] hover:bg-white/10 transition-colors"
              style={{ border: "1.5px solid rgba(255,255,255,0.35)" }}
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-[#071f1d]">
        <div className="mx-auto max-w-[960px] px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8">
            <div className="col-span-2 md:col-span-1">
              <p className="text-[17px] font-medium text-white">Veloxis</p>
              <p className="mt-2.5 text-[13px] leading-[1.6] text-white/40">
                UK-based cross-border invoice discounting. Advancing 80% of export invoice value within 24 hours for exporters worldwide shipping to UK and EU buyers.
              </p>
              <p className="mt-3 text-[13px] text-white/30">hello@veloxis.com</p>
            </div>
            {[
              { title: "Product", links: ["How it works", "Why Veloxis", "FAQ"] },
              { title: "Company", links: ["About", "Partners", "Contact", "Careers"] },
              { title: "Legal", links: ["Privacy policy", "Terms & conditions", "Disclosure", "Cookies"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/30 mb-[14px]">{col.title}</h4>
                <div className="space-y-2">
                  {col.links.map((l) => (
                    <Link
                      key={l}
                      to={`/${l.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-")}`}
                      className="block text-[13px] text-white/40 hover:text-white transition-colors"
                    >
                      {l}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 pt-5 text-[12px] text-white/25" style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
            <span>© 2026 Veloxis Ltd. All rights reserved. Registered in England and Wales.</span>
            <div className="flex gap-3">
              <Link to="/privacy-policy" className="hover:text-white/50">Privacy</Link>
              <Link to="/terms" className="hover:text-white/50">Terms</Link>
              <Link to="/disclosure" className="hover:text-white/50">Disclosure</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
