import { Link } from "react-router-dom";

const STEPS = [
  {
    num: "01",
    title: "Onboard",
    body: "Register exporters on Veloxis. Handle local KYC using our structured document system. You know the market — we give you the tools.",
  },
  {
    num: "02",
    title: "We fund",
    body: "Veloxis underwrites buyer risk, generates the IPU, and wires the advance. You focus on origination. We handle compliance and settlement.",
  },
  {
    num: "03",
    title: "You grow",
    body: "Build a sustainable export financing pipeline. Every funded deal deepens the relationship between your network and the platform.",
  },
];

export function PartnersSection() {
  return (
    <section className="bg-white py-16 text-center" style={{ borderTop: "0.5px solid #e5e7eb" }}>
      <div className="mx-auto max-w-[960px] px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">For partners</p>
        <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
          Your exporters need working capital. We provide it.
        </h2>
        <p className="mx-auto mt-3 max-w-[480px] text-[14px] leading-[1.6] text-[#6b7280]">
          Veloxis works with trusted local partners — finance companies, trade associations, and origination networks who bring verified exporters to the platform.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="rounded-[14px] bg-[#f9fafb] p-6 text-center"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              <div className="text-[34px] font-medium text-[#ccfbf1] leading-none mb-2">{step.num}</div>
              <h3 className="text-[16px] font-medium text-[#111827] mb-2">{step.title}</h3>
              <p className="text-[13px] leading-[1.6] text-[#6b7280]">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Link
            to="/partners"
            className="inline-flex items-center gap-1.5 rounded-[10px] px-6 py-3 text-[14px] font-medium text-[#111827] hover:bg-[#f9fafb] transition-colors"
            style={{ border: "0.5px solid #d1d5db" }}
          >
            Become a partner →
          </Link>
        </div>
      </div>
    </section>
  );
}
