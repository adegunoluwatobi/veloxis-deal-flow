import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "What is invoice discounting?",
    a: "Invoice discounting is a form of short-term finance where we advance a percentage of your invoice value upfront, then collect payment from your buyer on the original terms. It's not a loan — we purchase the receivable.",
  },
  {
    q: "How much can I receive?",
    a: "We typically advance up to 80% of the invoice value. The exact percentage depends on the buyer profile, trade route, and payment terms.",
  },
  {
    q: "How long does the process take?",
    a: "From submission to funding decision is usually within 24 hours. Once approved and the IPU is signed by the buyer, funds are released to your account promptly.",
  },
  {
    q: "What documents do I need?",
    a: "A commercial invoice, bill of lading, buyer details, and your KYC documents (company registration, director ID, etc.). Our portal guides you through everything step by step.",
  },
  {
    q: "Is Veloxis a lender?",
    a: "No. Veloxis provides invoice discounting, which means we purchase your trade receivable. This doesn't create debt on your balance sheet like a traditional loan would.",
  },
  {
    q: "Can I use Veloxis for multiple invoices?",
    a: "Absolutely. Once onboarded, you can submit multiple invoices through our portal. Each is assessed independently, so you can keep your trade flowing.",
  },
];

export function FaqAccordion() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Frequently Asked Questions
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-foreground">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
