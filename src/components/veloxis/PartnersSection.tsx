import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Handshake, DollarSign, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: Handshake, title: "Refer", desc: "Introduce your exporter clients to Veloxis." },
  { icon: DollarSign, title: "We Fund", desc: "We handle underwriting, compliance, and funding." },
  { icon: TrendingUp, title: "You Earn", desc: "Grow your portfolio with transparent deal flow." },
];

export function PartnersSection() {
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
            Grow your deal flow. We handle the financing.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Finance originators and trade partners — refer your exporters to Veloxis 
            and earn on every funded application.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-10">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.5 }}
              className="text-center"
            >
              <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-cyan-600/10 to-teal-500/10 flex items-center justify-center mb-3">
                <step.icon className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" variant="outline" className="gap-2" asChild>
            <Link to="/partners">
              Become a Partner <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
