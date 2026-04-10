import { Clock, CircleDollarSign, X, Check } from "lucide-react";

const PROBLEMS = [
  "Can't fund your next shipment",
  "Supplier relationships break down",
  "Banks reject you — overseas buyer, no UK collateral",
  "Growth stalls while waiting to be paid",
];

const SOLUTIONS = [
  "80% advance within 24 hours",
  "No collateral — your receivable is the security",
  "Buyer keeps their standard payment terms",
  "Funds direct to your domiciliary account",
  "Fully disclosed and legally documented",
];

export function ProblemSolution() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-[960px] px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">The problem</p>
        <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
          You've shipped. Why are you still waiting?
        </h2>
        <p className="mt-3 max-w-[520px] text-[14px] leading-[1.6] text-[#6b7280]">
          The invoice exists. The buyer is real. The goods are gone. The problem is the 60 days in between.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Problem card */}
          <div className="rounded-2xl p-[26px]" style={{ border: "0.5px solid #fca5a5", background: "#fff7f7" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fee2e2]">
                <Clock className="h-5 w-5 text-[#ef4444]" />
              </div>
              <h3 className="text-[16px] font-medium text-[#111827]">The problem</h3>
            </div>
            <p className="text-[14px] leading-[1.6] text-[#6b7280] mb-4">
              You ship on 30–60 day terms. The invoice is real, goods gone — but you wait months while covering suppliers, staff, and overheads.
            </p>
            <div className="space-y-3">
              {PROBLEMS.map((p) => (
                <div key={p} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fee2e2]">
                    <X className="h-3 w-3 text-[#ef4444]" />
                  </div>
                  <span className="text-[13px] text-[#6b7280]">{p}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Solution card */}
          <div className="rounded-2xl p-[26px]" style={{ border: "0.5px solid #99f6e4", background: "#f0fdfa" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ccfbf1]">
                <CircleDollarSign className="h-5 w-5 text-[#0d9488]" />
              </div>
              <h3 className="text-[16px] font-medium text-[#111827]">The Veloxis solution</h3>
            </div>
            <p className="text-[14px] leading-[1.6] text-[#6b7280] mb-4">
              Once approved and your buyer signs the IPU, Veloxis advances 80% to your domiciliary account within 24 hours.
            </p>
            <div className="space-y-3">
              {SOLUTIONS.map((s) => (
                <div key={s} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ccfbf1]">
                    <Check className="h-3 w-3 text-[#0d9488]" />
                  </div>
                  <span className="text-[13px] text-[#6b7280]">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
