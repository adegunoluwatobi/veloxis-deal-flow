import { Link } from "react-router-dom";
import { TypingHeadline } from "@/components/ui/typing-headline";
import { WorldMap } from "@/components/ui/world-map";

export function HeroSection() {
  return (
    <section className="bg-white" style={{ borderBottom: "0.5px solid #e5e7eb" }}>
      <div className="mx-auto grid max-w-[1080px] grid-cols-1 md:grid-cols-2 items-center gap-10 px-8 pt-[72px] pb-16" style={{ minHeight: 520 }}>
        {/* Left */}
        <div>
          {/* Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-[14px] py-[5px] text-[12px] font-medium text-[#0f766e] mb-3">
            <span className="relative flex h-[6px] w-[6px]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0d9488] opacity-75" />
              <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-[#0d9488]" />
            </span>
            Invoice finance for African commodity exporters
          </div>

          {/* Typing headline */}
          <h1 className="mb-4 text-[42px] font-medium leading-[1.12] text-[#111827]">
            <TypingHeadline
              lines={[
                { text: "Ship today. Get paid today.", speed: 55 },
                { text: "Not 30 to 90 days later.", speed: 68, className: "text-[#0d9488]" },
              ]}
            />
          </h1>

          {/* Subtitle */}
          <p className="mb-6 max-w-[420px] text-[14px] leading-[1.6] text-[#6b7280]">
            Veloxis provides invoice finance to African commodity exporters shipping to verified buyers in the United Kingdom and Europe. Receive the bulk of your invoice value the day shipment is verified, with the balance settled when the buyer pays.
          </p>

          {/* Buttons */}
          <div className="mb-6 flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0d9488] px-6 py-3 text-[14px] font-medium text-white hover:bg-[#0f766e] transition-colors"
            >
              Apply now →
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-[10px] px-6 py-3 text-[14px] font-medium text-[#111827] transition-colors hover:bg-[#f9fafb]"
              style={{ border: "0.5px solid #d1d5db" }}
            >
              How it works
            </Link>
          </div>

          {/* Trust strip */}
          <div className="mt-6 flex flex-wrap gap-3">
            {["No Collateral", "24-Hour Decisions", "Domiciliary Settlement"].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
                <span className="h-[5px] w-[5px] rounded-full bg-[#0d9488]" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right — World Map */}
        <div>
          <WorldMap />
        </div>
      </div>
    </section>
  );
}
