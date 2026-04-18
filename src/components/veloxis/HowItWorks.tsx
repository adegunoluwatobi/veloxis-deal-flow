const STEPS = [
  {
    num: "01",
    title: "Submit",
    body: "Your local Veloxis partner verifies your KYC. Upload your commercial invoice, Bill of Lading, and buyer details through the secure portal.",
  },
  {
    num: "02",
    title: "We underwrite",
    body: "Our team verifies trade documents, assesses your buyer's payment risk, and runs compliance checks within 24 hours of a complete submission.",
  },
  {
    num: "03",
    title: "Buyer signs IPU",
    body: "We send your buyer an Irrevocable Payment Undertaking. They sign digitally, committing to pay Veloxis directly on the invoice due date.",
  },
  {
    num: "04",
    title: "Funds released",
    body: "80% wired to your domiciliary account immediately. At maturity, buyer pays Veloxis. We deduct fees and send you the residual balance.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-white py-16" style={{ borderTop: "0.5px solid #e5e7eb" }}>
      <div className="mx-auto max-w-[960px] px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">The process</p>
        <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
          From invoice to funds. Four steps.
        </h2>
        <p className="mt-3 max-w-[480px] text-[14px] leading-[1.6] text-[#6b7280]">
          Built for cross-border trade — not adapted from a domestic template.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="rounded-[14px] bg-[#f9fafb] p-6"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              <div className="text-[40px] font-medium text-[#ccfbf1] leading-none mb-2">{step.num}</div>
              <h3 className="text-[16px] font-medium text-[#111827] mb-2">{step.title}</h3>
              <p className="text-[13px] leading-[1.6] text-[#6b7280]">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
