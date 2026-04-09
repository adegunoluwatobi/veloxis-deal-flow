"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShapeProps {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient: string;
}

function Shape({ className, delay = 0, width = 400, height = 100, rotate = 0, gradient }: ShapeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -150, rotate: rotate - 15 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ duration: 2.4, delay, ease: [0.23, 0.86, 0.39, 0.96], opacity: { duration: 1.2 } }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ width, height }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            gradient,
            "blur-[2px] dark:blur-[1px]"
          )}
        />
        <div
          className={cn(
            "absolute inset-[1px] rounded-full",
            "bg-background/50 dark:bg-background/40",
            "backdrop-blur-[2px]",
            "border border-foreground/[0.04]"
          )}
        />
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "shadow-[0_2px_20px_-2px] shadow-black/[0.08]",
            "dark:shadow-[0_2px_20px_-2px] dark:shadow-black/[0.25]"
          )}
        />
      </motion.div>
    </motion.div>
  );
}

interface HeroGeometricProps {
  badge?: string;
  title1: string;
  title2: string;
  description?: string;
  children?: React.ReactNode;
}

export function HeroGeometric({ badge, title1, title2, description, children }: HeroGeometricProps) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/[0.07] via-transparent to-teal-400/[0.05] blur-3xl" />

      <div className="absolute inset-0 overflow-hidden">
        <Shape
          delay={0.3}
          width={600}
          height={140}
          rotate={12}
          gradient="from-cyan-500/[0.12]"
          className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
        />
        <Shape
          delay={0.5}
          width={500}
          height={120}
          rotate={-15}
          gradient="from-teal-400/[0.12]"
          className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
        />
        <Shape
          delay={0.4}
          width={300}
          height={80}
          rotate={-8}
          gradient="from-sky-500/[0.10]"
          className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
        />
        <Shape
          delay={0.6}
          width={200}
          height={60}
          rotate={20}
          gradient="from-emerald-400/[0.10]"
          className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          {badge && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/50 bg-muted/50 backdrop-blur-sm mb-8"
            >
              <span className="text-sm text-muted-foreground font-medium">{badge}</span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-normal tracking-tight">
              <span className="text-foreground">{title1}</span>
              <br />
              <span
                className="bg-gradient-to-r from-cyan-600 to-teal-500 bg-clip-text text-transparent"
              >
                {title2}
              </span>
            </h1>
          </motion.div>

          {description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto"
            >
              {description}
            </motion.p>
          )}

          {children && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mt-8"
            >
              {children}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
