import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { FileText, Search, Banknote, CheckCircle } from "lucide-react";

const STEPS = [
  {
    icon: FileText,
    title: "Submit",
    desc: "Upload your commercial invoice, bill of lading, and buyer details through our secure portal.",
  },
  {
    icon: Search,
    title: "Review",
    desc: "Our team verifies the trade pack, runs compliance checks, and assesses the buyer within 24 hours.",
  },
  {
    icon: Banknote,
    title: "Funds Released",
    desc: "Up to 80% of the invoice value is advanced directly to your nominated bank account.",
  },
  {
    icon: CheckCircle,
    title: "Buyer Repays",
    desc: "Your buyer pays Veloxis on the agreed terms. We settle the residual balance to you, minus fees.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            From invoice to funds in four steps
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            A simple, transparent process designed for SME exporters.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.5 }}
              className="relative rounded-xl border border-border bg-card p-6 text-center"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-gradient-to-br from-cyan-600 to-teal-500 flex items-center justify-center text-xs font-bold text-primary-foreground">
                {i + 1}
              </div>
              <div className="mt-3 mb-4 flex justify-center">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-cyan-600/10 to-teal-500/10 flex items-center justify-center">
                  <step.icon className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
