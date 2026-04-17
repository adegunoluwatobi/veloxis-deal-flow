import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { DIAL_COUNTRIES, DialCountry } from "@/lib/countriesDial";

interface CountryPhoneSelectProps {
  /** Selected country ISO code, e.g. "NG" */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}

/**
 * Dark themed, fully searchable country dial code dropdown.
 * Designed to match the Veloxis dark emerald form palette.
 */
export function CountryPhoneSelect({ value, onChange, className }: CountryPhoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected: DialCountry =
    DIAL_COUNTRIES.find(c => c.iso === value) ?? DIAL_COUNTRIES.find(c => c.iso === "NG")!;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? DIAL_COUNTRIES.filter(c => c.name.toLowerCase().includes(q))
    : DIAL_COUNTRIES;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Auto-focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQuery("");
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-3 text-[14px] text-white border border-white/10 outline-none w-[120px] transition-colors hover:border-white/20"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <span className="text-[16px] leading-none">{selected.flag}</span>
        <span className="font-medium">{selected.dial}</span>
        <ChevronDown className="w-3.5 h-3.5 text-white/40 ml-auto" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-[320px] rounded-xl shadow-2xl overflow-hidden"
          style={{ background: "#143029", border: "1px solid rgba(26,188,156,0.25)" }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search country..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/30 outline-none"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[13px] text-white/40 text-center">No countries found</div>
            ) : (
              filtered.map(c => {
                const active = c.iso === selected.iso;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => {
                      onChange(c.iso);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors ${
                      active ? "bg-[#1ABC9C]/15 text-[#5FFFD7]" : "text-white/80 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="text-[16px] leading-none">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-white/40 text-[12px]">{c.dial}</span>
                    {active && <Check className="w-3.5 h-3.5 text-[#5FFFD7]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
