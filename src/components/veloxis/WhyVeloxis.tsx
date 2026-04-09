import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Landmark, Clock, Globe, FileCheck } from "lucide-react";

const REASONS = [
  {
    icon: Landmark,
    title: "No Loan Required",
    desc: "Invoice discounting isn't borrowing. We buy your receivable — no debt on your balance sheet.",
  },
  {
    icon: Clock,
    title: "24-Hour Decisions",
    desc: "Submit today, receive a decision by tomorrow. No weeks of committee approvals.",
  },
  {
    icon: Globe,
    title: "Cross-Border Specialists",
    desc: "We understand export logistics, FX, and international buyer risk — built for this trade.",
  },
  {
    icon: FileCheck,
    title: "Clear Documentation",
    desc: "Every fee, every rate, every step — fully disclosed upfront. No hidden charges.",
  },
];

export function WhyVeloxis() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Built for the trade, not the bank.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Veloxis is purpose-built for SME exporters who need fast, transparent finance.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {REASONS.map((reason, i) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              className="group rounded-xl border border-border bg-card p-6 hover:border-teal-500/30 hover:shadow-[0_0_30px_-10px] hover:shadow-teal-500/10 transition-all duration-300"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-600/10 to-teal-500/10 flex items-center justify-center mb-4 group-hover:from-cyan-600/20 group-hover:to-teal-500/20 transition-colors">
                <reason.icon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{reason.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{reason.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
