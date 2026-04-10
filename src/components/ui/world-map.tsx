import { useEffect, useRef } from "react";

// Continent paths (simplified polygons)
const CONTINENTS = [
  // North America
  { d: "M60,45 L95,30 L130,25 L155,35 L160,55 L145,75 L130,85 L110,90 L95,80 L80,70 L65,60 Z", fill: "#e8f5f1", stroke: "#bcddd3" },
  // South America
  { d: "M110,130 L125,115 L140,120 L145,140 L140,170 L130,195 L120,210 L110,200 L105,175 L100,155 Z", fill: "#e8f5f1", stroke: "#bcddd3" },
  // Europe
  { d: "M240,30 L255,25 L270,28 L275,40 L268,50 L255,52 L245,48 L238,40 Z", fill: "#e8f5f1", stroke: "#bcddd3" },
  // UK (brighter)
  { d: "M237,35 L242,32 L244,37 L241,42 L237,40 Z", fill: "#b2e8d6", stroke: "#bcddd3" },
  // Africa
  { d: "M235,75 L260,65 L285,70 L295,90 L290,120 L280,150 L265,170 L250,175 L240,160 L230,135 L225,110 L228,90 Z", fill: "#e8f5f1", stroke: "#bcddd3" },
  // Middle East
  { d: "M290,55 L310,50 L320,60 L315,75 L300,80 L285,70 Z", fill: "#e8f5f1", stroke: "#bcddd3" },
  // South Asia
  { d: "M330,65 L355,55 L370,65 L365,85 L350,95 L335,90 L325,80 Z", fill: "#e8f5f1", stroke: "#bcddd3" },
  // East/SE Asia
  { d: "M370,30 L410,25 L440,35 L450,55 L445,75 L430,85 L410,90 L390,80 L375,65 L370,45 Z", fill: "#e8f5f1", stroke: "#bcddd3" },
  // Australia
  { d: "M400,155 L430,145 L455,150 L460,170 L445,185 L425,190 L405,180 L395,168 Z", fill: "#e8f5f1", stroke: "#bcddd3" },
];

// UK destination
const UK_POINT = { x: 240, y: 38 };

// Origin points
const ORIGINS = [
  { x: 255, y: 110, label: "Nigeria" },
  { x: 280, y: 140, label: "Kenya" },
  { x: 260, y: 165, label: "South Africa" },
  { x: 305, y: 65, label: "UAE" },
  { x: 345, y: 75, label: "India" },
  { x: 400, y: 80, label: "SE Asia" },
  { x: 420, y: 45, label: "China" },
  { x: 115, y: 155, label: "Brazil" },
  { x: 90, y: 55, label: "N. America" },
  { x: 235, y: 80, label: "Morocco" },
];

function getArcPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = (from.x + to.x) / 2;
  const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
  const midY = Math.min(from.y, to.y) - dist * 0.3;
  return `M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`;
}

export function WorldMap() {
  return (
    <div className="rounded-2xl border border-[hsl(220,13%,91%)] overflow-hidden bg-white">
      <svg viewBox="0 0 520 310" className="w-full h-auto" aria-label="Animated world map showing trade routes to the UK">
        {/* Dot grid pattern */}
        <defs>
          <pattern id="dotgrid" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="9" cy="9" r="0.7" fill="#0d9488" opacity="0.10" />
          </pattern>
          <style>{`
            @keyframes draw {
              0% { stroke-dashoffset: 340; opacity: 0; }
              4% { opacity: 0.75; }
              32% { stroke-dashoffset: 0; opacity: 0.75; }
              44% { stroke-dashoffset: 0; opacity: 0; }
              45% { stroke-dashoffset: 340; opacity: 0; }
              100% { stroke-dashoffset: 340; opacity: 0; }
            }
            @keyframes pulse-dot {
              0%, 100% { r: 2.5; }
              50% { r: 4.5; }
            }
            @keyframes pulse-uk-outer {
              0%, 100% { r: 10; opacity: 0.10; }
              50% { r: 18; opacity: 0.03; }
            }
            @keyframes pulse-uk-mid {
              0%, 100% { r: 5; }
              50% { r: 7; }
            }
          `}</style>
        </defs>

        <rect width="520" height="310" fill="white" />
        <rect width="520" height="310" fill="url(#dotgrid)" />

        {/* Continents */}
        {CONTINENTS.map((c, i) => (
          <path key={i} d={c.d} fill={c.fill} stroke={c.stroke} strokeWidth="0.5" />
        ))}

        {/* Arcs */}
        {ORIGINS.map((origin, i) => {
          const isAfricaOrAmericas = i < 3 || i === 7 || i === 8 || i === 9;
          return (
            <path
              key={`arc-${i}`}
              d={getArcPath(origin, UK_POINT)}
              fill="none"
              stroke={isAfricaOrAmericas ? "#0d9488" : "#14b8a6"}
              strokeWidth="1.5"
              strokeDasharray="340"
              strokeDashoffset="340"
              style={{
                animation: `draw 12s linear ${i * 1.2}s infinite`,
              }}
            />
          );
        })}

        {/* Origin dots */}
        {ORIGINS.map((origin, i) => (
          <circle
            key={`origin-${i}`}
            cx={origin.x}
            cy={origin.y}
            r="2.5"
            fill="#14b8a6"
            style={{
              animation: `pulse-dot 2.2s ease-in-out ${i * 0.3}s infinite`,
            }}
          />
        ))}

        {/* UK destination */}
        <circle cx={UK_POINT.x} cy={UK_POINT.y} r="10" fill="#0d9488" opacity="0.10"
          style={{ animation: "pulse-uk-outer 2.2s ease-in-out infinite" }} />
        <circle cx={UK_POINT.x} cy={UK_POINT.y} r="5" fill="#0d9488" opacity="0.5"
          style={{ animation: "pulse-uk-mid 2.2s ease-in-out infinite" }} />
        <circle cx={UK_POINT.x} cy={UK_POINT.y} r="3.5" fill="#0d9488" />

        {/* London label */}
        <rect x={UK_POINT.x + 8} y={UK_POINT.y - 8} width="42" height="16" rx="4" fill="white" stroke="#bcddd3" strokeWidth="0.5" />
        <text x={UK_POINT.x + 12} y={UK_POINT.y + 3} fill="#0f766e" fontSize="9" fontWeight="500">London</text>

        {/* Caption */}
        <text x="260" y="298" textAnchor="middle" fill="#0d9488" fontSize="10" opacity="0.65">
          Emerging markets worldwide → UK &amp; EU
        </text>
      </svg>
    </div>
  );
}
