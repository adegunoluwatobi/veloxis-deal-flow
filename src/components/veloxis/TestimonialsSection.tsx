import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  ContainerScroll,
  CardsContainer,
  CardTransformed,
  ReviewStars,
} from "@/components/ui/animated-cards-stack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const TESTIMONIALS = [
  {
    id: "t1",
    name: "Adebayo O.",
    profession: "Cocoa Exporter, Nigeria",
    rating: 5,
    description:
      "Veloxis released funds within 24 hours of submission. We shipped our next order the same week. Game-changing for our cash flow.",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
  },
  {
    id: "t2",
    name: "Fatima K.",
    profession: "Textile Exporter, Ghana",
    rating: 5,
    description:
      "No more chasing buyers for payment. Veloxis handles the wait. The process was simple and the team was responsive.",
    avatarUrl:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&auto=format&fit=crop&q=80",
  },
  {
    id: "t3",
    name: "Emmanuel N.",
    profession: "Agricultural Products, Kenya",
    rating: 4.5,
    description:
      "Finally a UK-based platform that understands cross-border trade. Transparent, documented, and genuinely fast.",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
  },
  {
    id: "t4",
    name: "Sarah M.",
    profession: "Finance Originator Partner",
    rating: 5,
    description:
      "As a partner I refer exporters to Veloxis with full confidence. The deal process is smooth and my clients get funded fast.",
    avatarUrl:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80",
  },
];

export function TestimonialsSection() {
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
            What exporters say
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Real experiences from SME exporters and finance partners using Veloxis.
          </p>
        </motion.div>

        <ContainerScroll>
          <CardsContainer className="max-w-2xl mx-auto">
            {TESTIMONIALS.map((t, index) => (
              <CardTransformed key={t.id} index={index}>
                <div className="mb-4">
                  <ReviewStars rating={t.rating} />
                  <p className="mt-3 text-foreground leading-relaxed italic">
                    "{t.description}"
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={t.avatarUrl} alt={t.name} />
                    <AvatarFallback>
                      {t.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.profession}</div>
                  </div>
                </div>
              </CardTransformed>
            ))}
          </CardsContainer>
        </ContainerScroll>
      </div>
    </section>
  );
}
