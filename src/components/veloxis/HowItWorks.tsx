const STEPS = [
  {
    title: "Submit your invoice",
    body: "Upload your commercial invoice, Letter of Credit or Invoice Payment Undertaking, and Sales & Purchase Agreement through the Veloxis platform.",
  },
  {
    title: "Partner review",
    body: "Your assigned Veloxis partner reviews your documents and verifies the transaction.",
  },
  {
    title: "Get funded",
    body: "Once approved, funds are released quickly so you can fulfil your order without waiting on buyer payment.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-white py-16" style={{ borderTop: "0.5px solid #e5e7eb" }}>
      <div className="mx-auto max-w-[960px] px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">The process</p>
        <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
          From invoice to funds. Three steps.
        </h2>
        <p className="mt-3 max-w-[480px] text-[14px] leading-[1.6] text-[#6b7280]">
          Built for cross-border trade — not adapted from a domestic template.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="rounded-[14px] bg-[#f9fafb] p-6"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              <h3 className="text-[16px] font-medium text-[#111827] mb-2">{step.title}</h3>
              <p className="text-[13px] leading-[1.6] text-[#6b7280]">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
