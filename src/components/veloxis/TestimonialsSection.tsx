import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "We shipped to our German buyer in February and needed cash for our March order. Veloxis had funds in our account within 24 hours of the IPU being signed. We have not missed an order since.",
    name: "Adebayo O.",
    role: "Solid minerals exporter, Nigeria",
  },
  {
    quote: "Our partner handled the documents. Veloxis handled the underwriting. We tracked the status on the portal and confirmed receipt when the residual arrived.",
    name: "Fatima K.",
    role: "Textile exporter, Ghana",
  },
  {
    quote: "Finally a UK-based platform that understands cross-border trade. The buyer signs, the money moves. No guessing, no chasing, no delays.",
    name: "Emmanuel N.",
    role: "Manufactured goods exporter, Kenya",
  },
  {
    quote: "I refer exporters to Veloxis with full confidence. The process is transparent, the team is responsive, and clients always know where their application stands.",
    name: "Chidi A.",
    role: "Trade finance partner, Nigeria",
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5 mb-2.5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="h-[13px] w-[13px] fill-[#f59e0b] text-[#f59e0b]" />
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section className="bg-[#f9fafb] py-16">
      <div className="mx-auto max-w-[960px] px-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">What exporters say</p>
        <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
          From the corridor we serve.
        </h2>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-[14px] text-left">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-[14px] bg-white p-[22px]"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              <Stars />
              <p className="text-[13px] italic leading-[1.6] text-[#6b7280] mb-[14px]">
                "{t.quote}"
              </p>
              <div className="text-[13px] font-medium text-[#111827]">{t.name}</div>
              <div className="text-[12px] text-[#6b7280]">{t.role}</div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[11px] text-[#6b7280]">
          Testimonials are illustrative. Individual results vary based on invoice value, buyer terms, and underwriting outcome.
        </p>
      </div>
    </section>
  );
}
