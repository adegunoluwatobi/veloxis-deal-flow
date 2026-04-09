import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function FooterCta() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 md:py-28 bg-gradient-to-br from-cyan-600 to-teal-500 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_60%)]" />
      <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Your invoice is an asset. Start using it.
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-lg mx-auto">
            Join exporters across Africa who are growing faster with Veloxis.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" variant="secondary" className="gap-2" asChild>
              <Link to="/contact">
                Apply Now <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/40 text-primary-foreground hover:bg-white/10 bg-white/10" asChild>
              <Link to="/contact">Talk to Us</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
