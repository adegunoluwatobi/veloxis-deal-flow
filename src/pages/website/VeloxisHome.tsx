import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
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
  ArrowDown,
  Loader2,
} from "lucide-react";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";

// ─── BRAND COLORS ────────────────────────────────────────────────────────────
const C = {
  deepEmerald: "#0B3D2E",
  darkTeal: "#0E5A47",
  accent: "#1ABC9C",
  mint: "#5FFFD7",
  darkBg: "#071f1d",
  cardBg: "#0d2f2a",
  cardBorder: "rgba(26,188,156,0.12)",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.60)",
  textMuted: "rgba(255,255,255,0.35)",
};

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface FaqItem { q: string; a: string }
interface SlideData {
  num: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: string;
  isSolution?: boolean;
}

// ─── FAQ DATA ────────────────────────────────────────────────────────────────

const faqs: FaqItem[] = [
  { q: "What is Veloxis?", a: "Veloxis is a UK-based trade finance platform. We advance cash to exporters who have shipped goods to buyers in the UK, EU, or US but are waiting 30 to 90 days to receive payment. We bridge that gap so exporters can trade without waiting." },
  { q: "Where is Veloxis based?", a: "Veloxis is registered and headquartered in the United Kingdom." },
  { q: "What is invoice discounting?", a: "Invoice discounting is trade finance where a financier advances cash against an unpaid invoice. Unlike a loan, there is no debt on your balance sheet. Veloxis purchases your receivable at a discount — you get cash now, we collect from your buyer at maturity. Your buyer signs a legal payment undertaking directly with Veloxis before any funds are released." },
  { q: "Who can use Veloxis?", a: "Veloxis is for incorporated businesses anywhere in the world that export non-agricultural, non-perishable goods to verified buyers in the UK or European Economic Area. You must be onboarded through a Veloxis-approved local partner. Sole traders and unregistered partnerships are not eligible." },
  { q: "Does Veloxis finance importers?", a: "Not directly. Veloxis finances the exporter's receivable, meaning the exporter receives the advance and the buyer pays Veloxis when the invoice falls due." },
  { q: "Does the exporter need to be UK-registered?", a: "No. The exporter can be based anywhere. What matters is that the buyer is in the UK, EU, or US and can be verified and underwritten." },
  { q: "Does Veloxis finance all buyers?", a: "No. Veloxis only finances transactions where the buyer is in the UK, EU, or US and can be properly verified, credit-checked, and underwritten." },
  { q: "Is Veloxis regulated?", a: "Veloxis operates under UK law and ensures all transactions are governed by English law, providing a robust legal framework for all parties." },
  { q: "How long does approval take?", a: "A complete application — all documents uploaded, KYC verified by your partner, buyer details confirmed — is reviewed within 24 hours. Once your buyer signs the IPU, funds are released typically within the same business day." },
  { q: "Do I need a UK bank account?", a: "No. Veloxis settles funds directly to your domiciliary account in your home country. You do not need a UK or EU bank account. This is one of the key reasons the platform was built." },
  { q: "What goods are eligible?", a: "Eligible: solid minerals, metals and scrap, manufactured goods, textiles, processed chemicals (non-hazardous), timber and wood products, processed seafood. Not eligible: raw agricultural produce, live animals, perishables, weapons, and controlled substances." },
  { q: "Is Veloxis a lender?", a: "No. Veloxis is an invoice discounting platform — we purchase your receivable at a discount. We are buying an asset, not extending a loan. No debt on your balance sheet and no loan agreement to service." },
  { q: "Can I submit multiple invoices?", a: "Yes. Once your KYC is verified and your profile is set up, subsequent deals are significantly faster. Many exporters use Veloxis on a rolling basis across multiple buyers and shipment cycles." },
];

// ─── SLIDE DATA ───────────────────────────────────────────────────────────────

const slides: SlideData[] = [
  {
    num: "01 of 04 — The problem",
    iconBg: "rgba(245,158,11,0.12)",
    icon: <Clock className="w-6 h-6 text-amber-500" />,
    title: "Waiting 30–60 days for payment",
    body: "You ship goods and wait months to be paid while still covering suppliers, staff, logistics, and overheads. The invoice is real. The money isn't there yet.",
  },
  {
    num: "02 of 04 — The problem",
    iconBg: "rgba(239,68,68,0.12)",
    icon: <XCircle className="w-6 h-6 text-red-500" />,
    title: "Banks reject emerging market exporters",
    body: "Overseas buyers, foreign currency receivables, no UK collateral — traditional lenders decline this segment every time. You're creditworthy. Their model just wasn't built for you.",
  },
  {
    num: "03 of 04 — The problem",
    iconBg: "rgba(168,85,247,0.12)",
    icon: <TrendingUp className="w-6 h-6 text-purple-500" />,
    title: "Cash flow gaps stall growth",
    body: "New orders get rejected. Supplier relationships break down. Growth stalls — not because of demand, but because of payment timing. Your business is healthy. Your cash flow isn't.",
  },
  {
    num: "04 of 04 — The problem",
    iconBg: "rgba(59,130,246,0.12)",
    icon: <MapPin className="w-6 h-6 text-blue-500" />,
    title: "No domiciliary account settlement",
    body: "Most finance platforms route funds through UK accounts you don't control — adding FX conversion costs and delays. Your money should arrive where your business actually operates.",
  },
  {
    num: "The solution",
    iconBg: "rgba(26,188,156,0.15)",
    icon: <Shield className="w-6 h-6 text-[#1ABC9C]" />,
    title: "Veloxis solves all of this.",
    body: "Once approved and your buyer signs the IPU, 80% of your invoice is in your domiciliary account within 24 hours. No collateral. No UK bank needed. Legally documented end to end.",
    isSolution: true,
  },
];

const dotLabels = [
  "Waiting to be paid",
  "Bank rejections",
  "Cash flow gaps",
  "No domiciliary settlement",
  "Veloxis solves it",
];

const solutionChecks = ["80% within 24hrs", "Zero collateral", "Domiciliary settlement", "IPU-backed legally"];

// ─── TICKER PILLS ─────────────────────────────────────────────────────────────

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

// ─── HOW IT WORKS / WHY CARDS DATA ───────────────────────────────────────────

const howItWorksSteps = [
  { icon: FileText, title: "Submit", body: "Partner verifies your KYC. Upload your commercial invoice, Bill of Lading, and buyer details." },
  { icon: Search, title: "We underwrite", body: "Our team verifies documents, assesses buyer risk, and completes compliance checks within 24 hours." },
  { icon: Shield, title: "Buyer signs IPU", body: "Your buyer signs an Irrevocable Payment Undertaking digitally, committing to pay Veloxis on the due date." },
  { icon: DollarSign, title: "Funds released", body: "80% wired to your domiciliary account. At maturity, buyer pays Veloxis. We send you the residual." },
];

const whyCardsLarge = [
  { kv: "Zero", kl: "Assets pledged", t: "No collateral. Ever.", b: "We finance your receivable — not your balance sheet. No property, no equipment, no personal guarantees.", c: "#1ABC9C", Icon: Shield },
  { kv: "24 hrs", kl: "Credit decision", t: "Faster than any bank.", b: "Submit today. Receive a decision tomorrow. No credit committees, no branch visits, no weeks of waiting.", c: "#0E5A47", Icon: Clock },
];

const whyCardsSmall = [
  { kv: "Your account", kl: "In your country", t: "No UK bank needed", b: "Funds go directly to your domiciliary account. No forced FX conversion, no accounts you don't control.", c: "#1ABC9C", Icon: Globe },
  { kv: "Legally", kl: "Secured", t: "IPU-backed transactions", b: "Your buyer signs an Irrevocable Payment Undertaking before any funds leave Veloxis. Binding and enforceable.", c: "#0E5A47", Icon: FileText },
  { kv: "Local", kl: "Partner network", t: "Guided from day one", b: "Local KYC partners handle your onboarding in your language and timezone. You are never navigating alone.", c: "#0B3D2E", Icon: Users },
];

const testimonials = [
  { flag: "🇳🇬", name: "Adebayo O.", role: "Solid minerals exporter, Nigeria", q: "We shipped to our German buyer in February and needed cash for our March order. Veloxis had funds in our account within 24 hours of the IPU being signed. We have not missed an order since." },
  { flag: "🇬🇭", name: "Fatima K.", role: "Textile exporter, Ghana", q: "Our partner handled the documents. Veloxis handled the underwriting. We tracked the status on the portal and confirmed receipt when the residual arrived." },
  { flag: "🇰🇪", name: "Emmanuel N.", role: "Manufactured goods exporter, Kenya", q: "Finally a UK-based platform that understands cross-border trade. The buyer signs, the money moves. No guessing, no chasing, no delays." },
  { flag: "🇳🇬", name: "Chidi A.", role: "Trade finance partner, Nigeria", q: "I refer exporters to Veloxis with full confidence. The process is transparent and clients always know exactly where their application stands." },
];

// ─── TYPING HEADLINE ─────────────────────────────────────────────────────────

function TypingHeadline() {
  const line1 = "You've shipped the goods.";
  const line2 = "Get paid now.";
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"l1" | "l2" | "pause">("l1");
  const idx = useRef(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === "l1") {
      if (idx.current < line1.length) {
        t = setTimeout(() => { setText(line1.slice(0, idx.current + 1)); idx.current++; }, 55);
      } else { t = setTimeout(() => { idx.current = 0; setPhase("l2"); }, 200); }
    } else if (phase === "l2") {
      if (idx.current < line2.length) {
        t = setTimeout(() => { setText(line1 + "\n" + line2.slice(0, idx.current + 1)); idx.current++; }, 68);
      } else { t = setTimeout(() => { idx.current = 0; setPhase("pause"); }, 3400); }
    } else {
      setText("");
      t = setTimeout(() => setPhase("l1"), 400);
    }
    return () => clearTimeout(t);
  }, [text, phase]);

  const parts = text.split("\n");
  return (
    <h1 className="text-[42px] md:text-[52px] font-semibold leading-[1.1] tracking-[-0.02em] text-white min-h-[130px]">
      {parts[0]}
      {parts.length > 1 && <><br /><span className="text-[#5FFFD7]">{parts[1]}</span></>}
      <span className="inline-block w-[3px] h-[1em] bg-[#5FFFD7] ml-1 align-text-bottom animate-blink" />
    </h1>
  );
}

// ─── TICKER ROW ───────────────────────────────────────────────────────────────

function TickerRow({ items, direction, variant }: { items: string[]; direction: "left" | "right"; variant: "problem" | "solution" }) {
  const doubled = [...items, ...items];
  const animClass = direction === "left" ? "animate-ticker-left" : "animate-ticker-right";
  const pillStyle = variant === "problem"
    ? "bg-white/[0.06] border-white/[0.08] text-white/50"
    : "bg-[#1ABC9C]/15 border-[#1ABC9C]/25 text-[#5FFFD7]";

  return (
    <div className="relative overflow-hidden group">
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10" style={{ background: `linear-gradient(to right, ${C.deepEmerald}, transparent)` }} />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10" style={{ background: `linear-gradient(to left, ${C.deepEmerald}, transparent)` }} />
      <div className={`flex gap-3 w-max ${animClass} group-hover:[animation-play-state:paused]`}>
        {doubled.map((text, i) => (
          <span key={i} className={`inline-flex items-center px-4 py-2 rounded-full border text-[13px] whitespace-nowrap ${pillStyle}`}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── SCROLL PROBLEM SECTION ───────────────────────────────────────────────────

const BAR_DURATION = 3000;

function ScrollProblemSection() {
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const barRAF = useRef<number | null>(null);
  const barStart = useRef<number | null>(null);
  const barEls = useRef<(HTMLDivElement | null)[]>([]);
  const currentRef = useRef(0);

  const goTo = useCallback((idx: number) => {
    if (idx === currentRef.current) return;
    const prev = currentRef.current;
    setExiting(prev);
    setTimeout(() => setExiting(null), 650);
    currentRef.current = idx;
    setCurrent(idx);

    barEls.current.forEach((b, i) => { if (b) b.style.width = i < idx ? "100%" : "0%"; });

    if (barRAF.current) cancelAnimationFrame(barRAF.current);
    barStart.current = null;
    const bar = barEls.current[idx];
    if (!bar) return;

    function step(ts: number) {
      if (!barStart.current) barStart.current = ts;
      const pct = Math.min(((ts - barStart.current!) / BAR_DURATION) * 100, 100);
      if (bar) bar.style.width = pct + "%";
      if (pct < 100) {
        barRAF.current = requestAnimationFrame(step);
      } else {
        if (currentRef.current < slides.length - 1) goTo(currentRef.current + 1);
      }
    }
    barRAF.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    goTo(0);
    return () => { if (barRAF.current) cancelAnimationFrame(barRAF.current); };
  }, [goTo]);

  useEffect(() => {
    function onScroll() {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, Math.min(1, -rect.top / total));
      const target = Math.min(slides.length - 1, Math.floor(scrolled * slides.length));
      if (target !== currentRef.current) {
        if (barRAF.current) cancelAnimationFrame(barRAF.current);
        barEls.current.forEach((b, i) => { if (b) b.style.width = i < target ? "100%" : "0%"; });
        const prev = currentRef.current;
        setExiting(prev);
        setTimeout(() => setExiting(null), 650);
        currentRef.current = target;
        setCurrent(target);
        barStart.current = null;
        const bar = barEls.current[target];
        if (bar) {
          function step(ts: number) {
            if (!barStart.current) barStart.current = ts;
            const pct = Math.min(((ts - barStart.current!) / BAR_DURATION) * 100, 100);
            if (bar) bar.style.width = pct + "%";
            if (pct < 100) barRAF.current = requestAnimationFrame(step);
          }
          barRAF.current = requestAnimationFrame(step);
        }
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const slide = slides[current];

  return (
    <section ref={sectionRef} className="relative" style={{ height: "500vh", background: C.deepEmerald }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="mx-auto max-w-[960px] h-full grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-center px-8">
          {/* LEFT */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-3">The problem</p>
            <h2 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.01em] text-white mb-4">
              Every barrier.<br />One platform.
            </h2>
            <p className="text-[14px] leading-[1.6] text-white/45 max-w-[380px] mb-10">
              Scroll to see the specific problems Veloxis was built to solve — and how we answer each one.
            </p>

            <div className="space-y-5">
              {dotLabels.map((label, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <button
                    onClick={() => goTo(i)}
                    className={`flex items-center gap-3 text-left transition-all duration-300 ${i === current ? "text-white" : "text-white/30 hover:text-white/50"}`}
                  >
                    <span className={`w-2 h-2 rounded-full transition-all duration-300 ${i === current ? "bg-[#1ABC9C] scale-125" : "bg-white/20"}`} />
                    {label}
                  </button>
                  <div className="ml-5 h-[2px] w-40 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      ref={(el) => { barEls.current[i] = el; }}
                      className="h-full rounded-full"
                      style={{ width: "0%", transition: "none", background: "linear-gradient(90deg, #1ABC9C, #5FFFD7)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 60, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -60, scale: 0.96 }}
                transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                className={`rounded-[20px] p-10 w-full max-w-[420px] border ${slide.isSolution ? "border-[#1ABC9C]/25" : "border-white/[0.06]"}`}
                style={{ background: slide.isSolution ? "rgba(26,188,156,0.08)" : "rgba(255,255,255,0.03)" }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: slide.iconBg }}>
                  {slide.icon}
                </div>
                <p className="text-[12px] text-white/35 mb-2">{slide.num}</p>
                <h3 className={`text-[22px] font-semibold leading-[1.2] tracking-[-0.01em] mb-3 ${slide.isSolution ? "text-[#5FFFD7]" : "text-white"}`}>
                  {slide.title}
                </h3>
                <p className="text-[14px] leading-[1.6] text-white/45">{slide.body}</p>
                {slide.isSolution && (
                  <div className="flex flex-wrap gap-2 mt-5">
                    {solutionChecks.map(c => (
                      <span key={c} className="inline-flex items-center gap-1.5 text-[12px] text-[#5FFFD7] bg-[#1ABC9C]/10 px-3 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {current < slides.length - 1 && (
              <div className="flex items-center gap-2 mt-6 text-white/20 text-[12px]">
                <span>Scroll</span>
                <ArrowDown className="w-3 h-3 animate-bounce" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── COMPARISON ANIMATION ────────────────────────────────────────────────────

const compSteps = ["Documents verified", "Deal approved", "Buyer signs IPU", "Funds released"];

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function ComparisonAnimation() {
  const [states, setStates] = useState<("waiting" | "processing" | "done")[]>(["waiting", "waiting", "waiting", "waiting"]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      while (!cancelled) {
        setStates(["waiting", "waiting", "waiting", "waiting"]);
        await delay(800);
        for (let i = 0; i < 4; i++) {
          if (cancelled) return;
          setStates(p => p.map((s, j) => (j === i ? "processing" : s) as "waiting" | "processing" | "done"));
          await delay(1400);
          if (cancelled) return;
          setStates(p => p.map((s, j) => (j === i ? "done" : s) as "waiting" | "processing" | "done"));
          await delay(400);
        }
        await delay(2800);
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[960px] mx-auto">
      {/* Old way */}
      <div className="rounded-[20px] p-8 min-h-[400px] flex flex-col justify-between" style={{ background: "#1a2926", border: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/40 text-sm font-medium">1</div>
            <div className="flex-1">
              <p className="text-[14px] font-medium text-white/70">Invoice submitted</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Loader2 className="w-3 h-3 text-white/30 animate-spin" />
                <span className="text-[12px] text-white/30">Bank reviewing…</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-[12px] font-medium text-white/40">Old way</span>
          <p className="text-[13px] text-white/30 mt-2">Exporters wait weeks. Usually rejected. One step. Stuck.</p>
        </div>
      </div>

      {/* With Veloxis */}
      <div className="rounded-[20px] p-8" style={{ background: "rgba(26,188,156,0.06)", border: "0.5px solid rgba(26,188,156,0.15)" }}>
        <div className="space-y-3">
          {compSteps.map((name, i) => {
            const s = states[i];
            const isDone = s === "done";
            const isProc = s === "processing";
            return (
              <div key={i} className="relative">
                {i < 3 && <div className="absolute left-4 top-9 w-px h-3 bg-[#1ABC9C]/20" />}
                <div className={`flex items-center gap-3 rounded-xl p-3 transition-colors duration-300 border ${isDone ? "border-[#1ABC9C]/20 bg-[#1ABC9C]/10" : "border-white/[0.06] bg-white/[0.03]"}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors duration-300 ${isDone ? "bg-[#1ABC9C] text-white" : isProc ? "bg-[#1ABC9C]/20 text-[#1ABC9C]" : "bg-white/10 text-white/40"}`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-[13px] font-medium ${isDone ? "text-[#5FFFD7]" : "text-white/70"}`}>{name}</p>
                    <div className="flex items-center gap-1.5">
                      {isProc && <Loader2 className="w-3 h-3 text-[#1ABC9C] animate-spin" />}
                      <span className={`text-[11px] ${isDone ? "text-[#1ABC9C]" : isProc ? "text-[#1ABC9C]" : "text-white/30"}`}>
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
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#1ABC9C]/15 text-[12px] font-medium text-[#5FFFD7]">With Veloxis</span>
          <p className="text-[13px] text-white/40 mt-2">Four steps. 80% in your account within 24 hours.</p>
        </div>
      </div>
    </div>
  );
}

// ─── FAQ ITEM ────────────────────────────────────────────────────────────────

function FaqItemComponent({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)" }}>
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left text-[14px] font-medium text-white hover:bg-white/[0.04] transition-colors">
        {item.q}
        <span className={`text-white/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▾</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <p className="px-5 pb-4 text-[13px] leading-[1.6] text-white/45">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function VeloxisWebsite() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen" style={{ scrollBehavior: "smooth", background: C.deepEmerald }}>
      <Helmet>
        <title>Veloxis - Trade without waiting.</title>
        <meta name="description" content="Veloxis is a UK-based trade finance platform that advances 80% of your invoice value within 24 hours. No collateral required." />
        <meta property="og:title" content="Veloxis - Trade without waiting." />
        <meta property="og:description" content="Veloxis is a UK-based trade finance platform that advances 80% of your invoice value within 24 hours. No collateral required." />
        <meta property="og:url" content="https://veloxis-deal-flow.lovable.app/" />
        <meta property="og:image" content="https://veloxis-deal-flow.lovable.app/og-image.png" />
      </Helmet>

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-3 backdrop-blur-md" style={{ background: "rgba(11,61,46,0.85)", borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}>
        <a href="/" className="cursor-pointer flex items-center gap-0">
          <img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" />
        </a>
        <div className="hidden md:flex items-center gap-8">
          {[{ l: "How it works", id: "hiw" }, { l: "Why Veloxis", id: "why" }, { l: "Partners", id: "partners" }, { l: "FAQ", id: "faq" }].map(link => (
            <button key={link.id} onClick={() => scrollTo(link.id)} className="text-[13px] font-medium text-white/50 hover:text-[#5FFFD7] transition-colors tracking-[-0.01em]">{link.l}</button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-[13px] font-medium text-white/50 hover:text-white transition-colors">Log in</Link>
          <Link to="/login" className="gradient-veloxis-btn text-white text-[13px] font-semibold px-5 py-2.5 rounded-[10px] transition-all duration-200 glow-mint-hover">Get started</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ minHeight: "max(80vh, 580px)", background: `linear-gradient(135deg, ${C.deepEmerald} 0%, ${C.darkTeal} 50%, ${C.deepEmerald} 100%)` }}>
        {/* Gradient orbs */}
        <div className="absolute top-[-80px] right-[120px] w-[340px] h-[340px] rounded-full opacity-[0.15] blur-[40px]" style={{ background: C.accent }} />
        <div className="absolute bottom-[40px] right-[60px] w-[220px] h-[220px] rounded-full opacity-[0.10] blur-[30px]" style={{ background: C.mint }} />
        <div className="absolute top-[200px] left-[-60px] w-[160px] h-[160px] rounded-full opacity-[0.08] blur-[20px]" style={{ background: C.accent }} />

        <div className="relative z-10 mx-auto max-w-[1080px] grid grid-cols-1 md:grid-cols-[55%_45%] items-center gap-12 px-8 py-14 md:py-14" style={{ minHeight: "max(80vh, 580px)" }}>
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-[14px] py-[6px] text-[12px] text-[#5FFFD7] mb-3" style={{ background: "rgba(26,188,156,0.10)", border: "1px solid rgba(26,188,156,0.25)" }}>
              <span className="relative flex h-[6px] w-[6px]">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1ABC9C] opacity-75" />
                <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-[#1ABC9C]" />
              </span>
              Working capital without borders
            </div>

            <TypingHeadline />

            <p className="mb-6 max-w-[420px] text-[16px] leading-[1.65] text-white/60 tracking-[-0.01em]">
              Get 80% of your invoice value in your account within 24 hours. No collateral required.
            </p>

            <div className="mb-6 flex flex-col sm:flex-row items-start gap-[14px]">
              <Link to="/login" className="inline-flex items-center gap-1.5 gradient-veloxis-btn text-white font-bold text-[15px] px-7 py-[14px] rounded-[14px] transition-all duration-200 glow-mint-hover">
                Apply now <ArrowRight className="w-4 h-4" />
              </Link>
              <button onClick={() => scrollTo("hiw")} className="text-white font-semibold text-[15px] px-7 py-[14px] rounded-[14px] border border-[#1ABC9C]/30 hover:bg-[#1ABC9C]/10 transition-all duration-200" style={{ background: "rgba(26,188,156,0.06)" }}>
                How it works
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-5">
              {["UK-Registered", "No Collateral", "24-Hour Decisions", "Domiciliary Settlement"].map(t => (
                <span key={t} className="flex items-center gap-2 text-[13px] text-white/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1ABC9C]" />{t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — browser mockup */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-[300px] h-[300px] rounded-full opacity-[0.12] blur-[60px]" style={{ background: C.accent }} />
            <div className="relative -rotate-[1.5deg] w-full max-w-[440px] rounded-2xl overflow-hidden glow-mint" style={{ background: C.cardBg }}>
              {/* Chrome bar */}
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "rgba(0,0,0,0.3)" }}>
                <div className="flex gap-1.5">
                  <span className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]" />
                  <span className="w-[10px] h-[10px] rounded-full bg-[#febc2e]" />
                  <span className="w-[10px] h-[10px] rounded-full bg-[#28c840]" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[11px] text-white/25">app.veloxis.co.uk</span>
                </div>
              </div>
              {/* Dashboard */}
              <div className="p-4 space-y-3" style={{ background: C.cardBg }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-[14px] font-medium">Good morning, Adebayo 👋</p>
                    <p className="text-white/35 text-[11px]">Lagos Metals Ltd · Exporter</p>
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-medium" style={{ background: "linear-gradient(135deg, #0E5A47, #1ABC9C)" }}>AO</div>
                </div>
                {/* Invoice card */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.2)", border: `0.5px solid ${C.cardBorder}` }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white/35 text-[10px]">Current application</p>
                      <p className="text-white text-[20px] font-semibold">$45,000</p>
                      <p className="text-white/25 text-[10px]">Invoice #INV-2026-041 · German buyer</p>
                    </div>
                    <span className="text-[10px] font-medium text-[#5FFFD7] bg-[#1ABC9C]/15 px-2 py-0.5 rounded-full">IPU Signed</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2.5" style={{ background: "rgba(26,188,156,0.06)" }}>
                      <p className="text-white/30 text-[9px]">You receive</p>
                      <p className="text-[#5FFFD7] text-[16px] font-semibold">$36,000</p>
                      <p className="text-white/20 text-[9px]">Today, 80% advance</p>
                    </div>
                    <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <p className="text-white/30 text-[9px]">Settlement</p>
                      <p className="text-white text-[16px] font-semibold">May 10</p>
                      <p className="text-white/20 text-[9px]">30-day terms</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: "80%", background: "linear-gradient(90deg, #0E5A47, #1ABC9C, #5FFFD7)" }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-white/25">
                    <span>80% advanced</span><span>20% on settlement</span>
                  </div>
                </div>
                {/* Steps */}
                <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,0.15)" }}>
                  <div>
                    <p className="text-white/25 text-[9px]">Step 3 of 4</p>
                    <p className="text-[#5FFFD7] text-[12px] font-medium">IPU Signed ✓</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/25 text-[9px]">Next</p>
                    <p className="text-white text-[12px] font-medium">Funds Released</p>
                  </div>
                </div>
                {/* Activity */}
                <div className="space-y-1.5">
                  <p className="text-white/25 text-[10px] font-medium">Activity</p>
                  {[
                    { c: "#5FFFD7", t: "Buyer signed IPU", time: "2h ago" },
                    { c: "#1ABC9C", t: "Deal approved by Veloxis", time: "Yesterday" },
                    { c: "#fbbf24", t: "Funds release pending", time: "Today" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: row.c }} />
                      <span className="text-white/40 flex-1">{row.t}</span>
                      <span className="text-white/20">{row.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-6" style={{ background: "rgba(26,188,156,0.04)", borderBottom: `0.5px solid ${C.cardBorder}` }}>
        <div className="mx-auto max-w-[780px] grid grid-cols-2 md:grid-cols-4 gap-6 px-8 text-center">
          {[
            { v: "80%", l: "Advanced on day one" },
            { v: "24hrs", l: "From approval to funds" },
            { v: "30–60", l: "Day payment terms" },
            { v: "UK & EU", l: "Buyer destination markets" },
          ].map(s => (
            <div key={s.v}>
              <p className="text-[28px] font-semibold text-[#5FFFD7]">{s.v}</p>
              <p className="text-[12px] text-white/40 mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCROLL PROBLEM SECTION ── */}
      <ScrollProblemSection />

      {/* ── TICKER ── */}
      <section className="py-16 space-y-8" style={{ background: C.deepEmerald }}>
        <div className="text-center px-8 mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-3">Built for your problems</p>
          <h2 className="text-[34px] font-semibold text-white leading-[1.2] tracking-[-0.01em] mb-3">Every barrier exporters face. Solved.</h2>
          <p className="text-[14px] text-white/45 max-w-[480px] mx-auto">Traditional finance was built for domestic markets. Veloxis was built for cross-border export discounting.</p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] text-white/25 uppercase tracking-wider px-8 mb-2">The challenges</p>
          <TickerRow items={problemPills} direction="left" variant="problem" />
        </div>
        <div className="h-px" style={{ background: "rgba(26,188,156,0.1)" }} />
        <div className="space-y-1">
          <div className="h-2" />
          <p className="text-[11px] text-[#1ABC9C]/50 uppercase tracking-wider px-8 mb-2">The Veloxis solution</p>
          <TickerRow items={solutionPills} direction="right" variant="solution" />
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section className="py-16 px-8" style={{ background: C.darkTeal }}>
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-3">The shift</p>
          <p className="text-[20px] text-white/35 mb-1">Banks gave you waiting.</p>
          <h2 className="text-[34px] font-semibold text-white leading-[1.2] tracking-[-0.01em]">Veloxis gives you working capital.</h2>
        </div>
        <ComparisonAnimation />
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="hiw" className="py-16 px-8" style={{ background: C.deepEmerald }}>
        <div className="mx-auto max-w-[960px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-3 text-center">How it works</p>
          <h2 className="text-[34px] font-semibold text-white leading-[1.2] tracking-[-0.01em] text-center mb-3">From invoice to funds.<br />Four steps.</h2>
          <p className="text-[14px] text-white/45 max-w-[480px] mx-auto text-center mb-12">Built for cross-border trade — not adapted from a domestic template.</p>
          <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-[2px]" style={{ background: "linear-gradient(90deg, transparent, rgba(26,188,156,0.3), transparent)" }} />
            {howItWorksSteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="text-center relative">
                  <div className="relative z-10 mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #0E5A47, #1ABC9C)" }}>
                    <div className="absolute inset-0 rounded-full bg-[#1ABC9C] opacity-20 animate-ping" style={{ animationDuration: "3s" }} />
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-[13px] text-white/45 leading-[1.6]">{step.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── WHY VELOXIS ── */}
      <section id="why" className="py-16 px-8" style={{ background: C.darkTeal }}>
        <div className="mx-auto max-w-[960px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-3 text-center">Why Veloxis</p>
          <h2 className="text-[34px] font-semibold text-white leading-[1.2] tracking-[-0.01em] text-center mb-3">Built for this trade.<br />Not retrofitted for it.</h2>
          <p className="text-[14px] text-white/45 max-w-[520px] mx-auto text-center mb-10">Every feature exists because of the specific barriers exporters in emerging markets face when accessing working capital.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {whyCardsLarge.map(card => {
              const Icon = card.Icon;
              return (
                <div key={card.kv} className="relative rounded-2xl p-[26px] border hover:-translate-y-[3px] transition-all duration-200 overflow-hidden glow-mint-hover" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(26,188,156,0.12)" }}>
                  <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${card.c}, #5FFFD7)` }} />
                  <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-4" style={{ background: "rgba(26,188,156,0.10)" }}>
                    <Icon className="w-6 h-6 text-[#1ABC9C]" />
                  </div>
                  <p className="text-[28px] font-semibold text-[#5FFFD7]">{card.kv}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35 mb-2.5">{card.kl}</p>
                  <h3 className="text-[16px] font-semibold text-white mb-2">{card.t}</h3>
                  <p className="text-[14px] text-white/45 leading-[1.6]">{card.b}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {whyCardsSmall.map(card => {
              const Icon = card.Icon;
              return (
                <div key={card.kv} className="relative rounded-2xl p-[26px] border hover:-translate-y-[3px] transition-all duration-200 overflow-hidden glow-mint-hover" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(26,188,156,0.12)" }}>
                  <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${card.c}, #1ABC9C)` }} />
                  <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-4" style={{ background: "rgba(26,188,156,0.10)" }}>
                    <Icon className="w-6 h-6 text-[#1ABC9C]" />
                  </div>
                  <p className="text-[22px] font-semibold text-[#5FFFD7]">{card.kv}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35 mb-2.5">{card.kl}</p>
                  <h3 className="text-[16px] font-semibold text-white mb-2">{card.t}</h3>
                  <p className="text-[14px] text-white/45 leading-[1.6]">{card.b}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PARTNERS ── */}
      <section id="partners" className="py-16 px-8" style={{ background: C.deepEmerald }}>
        <div className="mx-auto max-w-[960px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-3 text-center">For partners</p>
          <h2 className="text-[34px] font-semibold text-white leading-[1.2] tracking-[-0.01em] text-center mb-3">Your exporters need working capital.<br />We provide it.</h2>
          <p className="text-[14px] text-white/45 max-w-[480px] mx-auto text-center mb-10">Veloxis works with trusted local partners — finance companies, trade associations, and origination networks.</p>

          <div className="rounded-[24px] p-8 md:p-10" style={{ background: "rgba(0,0,0,0.2)", border: "0.5px solid rgba(26,188,156,0.1)" }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[
                { n: "01", t: "Onboard", b: "Register exporters on Veloxis. Handle local KYC using our structured document system. You know the market — we give you the tools." },
                { n: "02", t: "We fund", b: "Veloxis underwrites buyer risk, generates the IPU, and wires the advance. You focus on origination. We handle compliance and settlement." },
                { n: "03", t: "You grow", b: "Build a sustainable export financing pipeline. Every funded deal deepens the relationship between your network and the platform." },
              ].map(card => (
                <div key={card.n} className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(26,188,156,0.12)", borderTop: "3px solid #1ABC9C" }}>
                  <p className="text-[34px] font-semibold text-white/8 mb-3">{card.n}</p>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "rgba(26,188,156,0.12)" }}>
                    <Users className="w-5 h-5 text-[#1ABC9C]" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-white mb-2">{card.t}</h3>
                  <p className="text-[13px] text-white/45 leading-[1.6]">{card.b}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ background: "rgba(26,188,156,0.08)", border: "0.5px solid rgba(26,188,156,0.2)" }}>
              <div>
                <p className="text-white font-semibold text-[15px]">Ready to become a Veloxis partner?</p>
                <p className="text-white/45 text-[13px]">Bring your exporters. We handle the rest.</p>
              </div>
              <Link to="/contact" className="inline-flex items-center gap-1.5 gradient-veloxis-btn text-white font-semibold text-[13px] px-5 py-2.5 rounded-lg transition-all duration-200 glow-mint-hover whitespace-nowrap">
                Become a partner <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 px-8" style={{ background: C.darkTeal }}>
        <div className="mx-auto max-w-[960px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-3 text-center">What exporters say</p>
          <h2 className="text-[34px] font-semibold text-white leading-[1.2] tracking-[-0.01em] text-center mb-10">From the corridor we serve.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testimonials.map(t => (
              <div key={t.name} className="rounded-xl p-[22px]" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(26,188,156,0.12)" }}>
                <p className="text-[13px] text-[#fbbf24] mb-2.5">★★★★★</p>
                <p className="text-[13px] text-white/50 italic leading-[1.6] mb-3.5">"{t.q}"</p>
                <p className="text-[13px] font-semibold text-white">{t.flag} {t.name}</p>
                <p className="text-[12px] text-white/35">{t.role}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/20 text-center mt-6">Testimonials are illustrative. Individual results vary based on invoice value, buyer terms, and underwriting outcome.</p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-16 px-8" style={{ background: C.deepEmerald }}>
        <div className="mx-auto max-w-[640px] space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-3 text-center">FAQ</p>
          <h2 className="text-[34px] font-semibold text-white leading-[1.2] tracking-[-0.01em] text-center mb-2">Everything you need to know.</h2>
          <p className="text-[14px] text-white/40 text-center mb-8">Still have questions? hello@veloxis.com</p>
          {faqs.map((item, i) => (
            <FaqItemComponent key={i} item={item} isOpen={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-16 px-8 overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.deepEmerald}, ${C.darkTeal})` }}>
        <div className="absolute top-[-40px] right-[80px] w-[200px] h-[200px] rounded-full opacity-[0.10] blur-[40px]" style={{ background: C.mint }} />
        <div className="relative z-10 text-center max-w-[520px] mx-auto">
          <h2 className="text-[34px] font-semibold text-white leading-[1.2] tracking-[-0.01em] mb-4">Your invoice is an asset.<br />Start using it.</h2>
          <p className="text-[15px] text-[#5FFFD7]/80 mb-7 max-w-[440px] mx-auto">Join exporters from emerging markets worldwide growing faster because they are not waiting 60 days to be paid.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/contact" className="inline-flex items-center justify-center gap-1.5 gradient-veloxis-btn text-white font-semibold text-[14px] px-6 py-3 rounded-[10px] transition-all duration-200 glow-mint-hover">
              Apply now <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center text-white text-[14px] px-6 py-3 rounded-[10px] border border-[#1ABC9C]/30 hover:bg-[#1ABC9C]/10 transition-all duration-200">
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 px-8" style={{ background: C.darkBg, borderTop: "0.5px solid rgba(26,188,156,0.08)" }}>
        <div className="mx-auto max-w-[960px] grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 mb-8">
          <div>
            <a href="/"><img src={veloxisLogoWhite} alt="Veloxis" className="h-9 w-auto mb-3" /></a>
            <p className="text-[13px] text-white/35 leading-[1.6] mb-3">UK-based cross-border invoice discounting. Advancing 80% of export invoice value within 24 hours for exporters worldwide shipping to UK and EU buyers.</p>
            <p className="text-[13px] text-white/25">hello@veloxis.com</p>
          </div>
          {[
            { title: "Product", links: ["How it works", "Why Veloxis", "FAQ"] },
            { title: "Company", links: ["About", "Partners", "Contact", "Careers"] },
            { title: "Legal", links: ["Privacy policy", "Terms & conditions", "Disclosure", "Cookies"] },
          ].map(col => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/25 mb-3.5">{col.title}</p>
              {col.links.map(l => <p key={l} className="text-[13px] text-white/35 mb-2 hover:text-[#5FFFD7] cursor-pointer transition-colors">{l}</p>)}
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-[960px] flex flex-col md:flex-row justify-between items-center pt-5 gap-2" style={{ borderTop: "0.5px solid rgba(26,188,156,0.08)" }}>
          <p className="text-[12px] text-white/15">© 2026 Veloxis Ltd. All rights reserved. Registered in England and Wales.</p>
          <p className="text-[12px] text-white/15">Privacy · Terms · Disclosure</p>
        </div>
      </footer>

    </div>
  );
}
