"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TypewriterProps {
  text: string[];
  speed?: number;
  deleteSpeed?: number;
  pauseDuration?: number;
  className?: string;
  cursorClassName?: string;
}

export function Typewriter({
  text,
  speed = 50,
  deleteSpeed = 30,
  pauseDuration = 2000,
  className,
  cursorClassName,
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const tick = useCallback(() => {
    const currentFullText = text[textIndex];

    if (!isDeleting) {
      if (displayedText.length < currentFullText.length) {
        setDisplayedText(currentFullText.slice(0, displayedText.length + 1));
        return speed;
      } else {
        return pauseDuration;
      }
    } else {
      if (displayedText.length > 0) {
        setDisplayedText(currentFullText.slice(0, displayedText.length - 1));
        return deleteSpeed;
      } else {
        setIsDeleting(false);
        setTextIndex((prev) => (prev + 1) % text.length);
        return speed;
      }
    }
  }, [displayedText, isDeleting, textIndex, text, speed, deleteSpeed, pauseDuration]);

  useEffect(() => {
    const currentFullText = text[textIndex];
    if (!isDeleting && displayedText === currentFullText) {
      const timer = setTimeout(() => setIsDeleting(true), pauseDuration);
      return () => clearTimeout(timer);
    }

    const nextDelay = tick();
    const timer = setTimeout(() => {
      // Trigger re-render
      if (!isDeleting) {
        if (displayedText.length < currentFullText.length) {
          setDisplayedText(currentFullText.slice(0, displayedText.length + 1));
        }
      } else {
        if (displayedText.length > 0) {
          setDisplayedText(currentFullText.slice(0, displayedText.length - 1));
        } else {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % text.length);
        }
      }
    }, isDeleting ? deleteSpeed : speed);

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, textIndex, text, speed, deleteSpeed, pauseDuration]);

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span>{displayedText}</span>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
        className={cn("inline-block w-[3px] h-[1em] ml-1 bg-current", cursorClassName)}
      />
    </span>
  );
}
