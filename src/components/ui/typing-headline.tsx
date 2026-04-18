import { useEffect, useState, useRef } from "react";

interface TypingHeadlineProps {
  lines: { text: string; className?: string; speed?: number }[];
  pauseMs?: number;
}

export function TypingHeadline({ lines, pauseMs = 3200 }: TypingHeadlineProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pausing" | "clearing">("typing");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const currentLine = lines[lineIndex];
  const speed = currentLine?.speed ?? 55;

  useEffect(() => {
    if (phase === "typing") {
      if (charIndex < (currentLine?.text.length ?? 0)) {
        timerRef.current = setTimeout(() => setCharIndex((c) => c + 1), speed);
      } else if (lineIndex < lines.length - 1) {
        // Move to next line
        timerRef.current = setTimeout(() => {
          setLineIndex((l) => l + 1);
          setCharIndex(0);
        }, 200);
      } else {
        // All lines done, pause
        setPhase("pausing");
      }
    } else if (phase === "pausing") {
      timerRef.current = setTimeout(() => setPhase("clearing"), pauseMs);
    } else if (phase === "clearing") {
      timerRef.current = setTimeout(() => {
        setLineIndex(0);
        setCharIndex(0);
        setPhase("typing");
      }, 400);
    }
    return () => clearTimeout(timerRef.current);
  }, [charIndex, lineIndex, phase, lines, speed, pauseMs, currentLine]);

  const renderedLines = lines.map((line, i) => {
    let text = "";
    if (phase === "clearing") text = "";
    else if (i < lineIndex) text = line.text;
    else if (i === lineIndex) text = line.text.slice(0, charIndex);
    else text = "";
    return { ...line, displayText: text };
  });

  const showCursor = phase !== "clearing";

  return (
    <span className="inline" style={{ minHeight: "110px", display: "block" }}>
      {renderedLines.map((line, i) => (
        <span key={i}>
          {i > 0 && renderedLines[i - 1].displayText.length > 0 && <br />}
          <span className={line.className}>{line.displayText}</span>
          {i === lineIndex && showCursor && (
            <span
              className="inline-block w-[2px] h-[1em] ml-0.5 align-text-bottom"
              style={{
                backgroundColor: "#0d9488",
                animation: "blink-cursor 0.8s step-end infinite",
              }}
            />
          )}
        </span>
      ))}
      <style>{`
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}
