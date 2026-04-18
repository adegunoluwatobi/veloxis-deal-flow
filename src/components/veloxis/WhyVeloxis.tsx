import { Shield, Clock, Globe, FileText, Users } from "lucide-react";

const ROW1 = [
  {
    strip: "#0d9488",
    icon: Shield,
    kicker: "Zero",
    kickerLabel: "ASSETS PLEDGED",
    title: "No collateral. Ever.",
    body: "We finance your receivable — not your balance sheet. No property, no equipment, no personal guarantees. If the invoice is real and the buyer is verified, it qualifies. Your business stays debt-free.",
    kickerSize: "text-[28px]",
  },
  {
    strip: "#0f766e",
    icon: Clock,
    kicker: "24 hrs",
    kickerLabel: "CREDIT DECISION",
    title: "Faster than any bank.",
    body: "Submit today. Receive a decision tomorrow. No credit committees, no branch visits, no weeks of waiting. Your next shipment cannot afford delays — so neither can your financing.",
    kickerSize: "text-[28px]",
  },
];

const ROW2 = [
  {
    strip: "#14b8a6",
    icon: Globe,
    kicker: "Your account",
    kickerLabel: "IN YOUR COUNTRY",
    title: "No UK bank needed",
    body: "Funds go directly to your domiciliary account — no forced FX conversion, no accounts you don't control.",
    kickerSize: "text-[22px]",
  },
  {
    strip: "#0d9488",
    icon: FileText,
    kicker: "Legally",
    kickerLabel: "SECURED",
    title: "IPU-backed transactions",
    body: "Your buyer signs an Irrevocable Payment Undertaking before any funds leave Veloxis. Every transaction is legally binding and enforceable.",
    kickerSize: "text-[22px]",
  },
  {
    strip: "#0f766e",
    icon: Users,
    kicker: "Local",
    kickerLabel: "PARTNER NETWORK",
    title: "Guided from day one",
    body: "Local KYC partners handle your onboarding in your language and timezone. You are never navigating alone.",
    kickerSize: "text-[22px]",
  },
];

function FeatureCard({
  strip, icon: Icon, kicker, kickerLabel, title, body, kickerSize,
}: typeof ROW1[0]) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-white p-[26px] transition-all duration-200 hover:-translate-y-[3px] hover:border-[#0d9488]"
      style={{ border: "0.5px solid #e5e7eb" }}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: strip }} />
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#f0fdfa]">
        <Icon className="h-6 w-6 text-[#0d9488]" />
      </div>
      <div className={`${kickerSize} font-medium text-[#0d9488]`}>{kicker}</div>
      <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#6b7280] mb-2.5">{kickerLabel}</div>
      <h3 className="text-[16px] font-medium text-[#111827] mb-2">{title}</h3>
      <p className="text-[13px] leading-[1.6] text-[#6b7280]">{body}</p>
    </div>
  );
}

export function WhyVeloxis() {
  return (
    <section className="bg-white py-16" style={{ borderTop: "0.5px solid #e5e7eb" }}>
      <div className="mx-auto max-w-[960px] px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">Why Veloxis</p>
        <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
          Built for this trade. Not retrofitted for it.
        </h2>
        <p className="mt-3 max-w-[520px] text-[14px] leading-[1.6] text-[#6b7280]">
          Every feature exists because of the specific barriers exporters in emerging markets face when trying to access working capital.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ROW1.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ROW2.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}
