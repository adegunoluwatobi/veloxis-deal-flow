import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Clock, Zap } from "lucide-react";

export function ProblemSolution() {
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
            You've shipped. Why are you still waiting?
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="rounded-xl border border-destructive/20 bg-destructive/5 p-8"
          >
            <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">The Problem</h3>
            <p className="text-muted-foreground leading-relaxed">
              Exporters ship goods but wait 30–60 days for buyer payment. Cash is tied up, 
              new orders stall, and growth is constrained by slow-paying buyers across borders.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="rounded-xl border border-border bg-gradient-to-br from-cyan-500/5 to-teal-500/5 p-8"
          >
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-cyan-600/20 to-teal-500/20 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">The Veloxis Solution</h3>
            <p className="text-muted-foreground leading-relaxed">
              Submit your invoice to Veloxis. We advance up to 80% of its value within 24 hours. 
              Your buyer pays us on the original terms. You ship again — immediately.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
