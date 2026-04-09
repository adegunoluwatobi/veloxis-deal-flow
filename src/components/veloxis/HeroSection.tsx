import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import { Typewriter } from "@/components/ui/typewriter";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <HeroGeometric
      badge="Cross-Border Invoice Discounting"
      title1="Get Paid Today."
      title2="Ship Tomorrow."
    >
      <div className="mt-4 h-8 text-lg md:text-xl text-muted-foreground">
        <Typewriter
          text={[
            "80% of invoice value advanced within 24 hours.",
            "No more waiting 30–60 days for buyers to pay.",
            "Built for cross-border SME exporters.",
            "UK-based. Regulated. Transparent.",
          ]}
          speed={40}
          deleteSpeed={25}
          pauseDuration={2500}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
        <Button size="lg" className="bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-700 hover:to-teal-600 text-primary-foreground gap-2" asChild>
          <Link to="/contact">
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link to="/how-it-works">How It Works</Link>
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-teal-500" aria-label="Trusted" />
        UK-Based · Regulated · Transparent · 24-Hour Decisions
      </div>
    </HeroGeometric>
  );
}
