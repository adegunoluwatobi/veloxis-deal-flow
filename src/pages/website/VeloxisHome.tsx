import { WebsiteLayout } from "@/components/veloxis/WebsiteLayout";
import { HeroSection } from "@/components/veloxis/HeroSection";
import { StatBar } from "@/components/veloxis/StatBar";
import { ProblemSolution } from "@/components/veloxis/ProblemSolution";
import { HowItWorks } from "@/components/veloxis/HowItWorks";
import { WhyVeloxis } from "@/components/veloxis/WhyVeloxis";
import { TestimonialsSection } from "@/components/veloxis/TestimonialsSection";
import { PartnersSection } from "@/components/veloxis/PartnersSection";
import { FaqAccordion } from "@/components/veloxis/FaqAccordion";
import { FooterCta } from "@/components/veloxis/FooterCta";

export default function VeloxisHome() {
  return (
    <WebsiteLayout>
      <HeroSection />
      <StatBar />
      <ProblemSolution />
      <HowItWorks />
      <WhyVeloxis />
      <TestimonialsSection />
      <PartnersSection />
      <FaqAccordion />
      <FooterCta />
    </WebsiteLayout>
  );
}
