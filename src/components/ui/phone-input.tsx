import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Search } from "lucide-react";

interface Country {
  name: string;
  code: string;
  dial: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { name: "Nigeria", code: "NG", dial: "+234", flag: "🇳🇬" },
  { name: "United Kingdom", code: "GB", dial: "+44", flag: "🇬🇧" },
  { name: "United States", code: "US", dial: "+1", flag: "🇺🇸" },
  { name: "Ghana", code: "GH", dial: "+233", flag: "🇬🇭" },
  { name: "Kenya", code: "KE", dial: "+254", flag: "🇰🇪" },
  { name: "South Africa", code: "ZA", dial: "+27", flag: "🇿🇦" },
  { name: "Canada", code: "CA", dial: "+1", flag: "🇨🇦" },
  { name: "Germany", code: "DE", dial: "+49", flag: "🇩🇪" },
  { name: "France", code: "FR", dial: "+33", flag: "🇫🇷" },
  { name: "Netherlands", code: "NL", dial: "+31", flag: "🇳🇱" },
  { name: "India", code: "IN", dial: "+91", flag: "🇮🇳" },
  { name: "China", code: "CN", dial: "+86", flag: "🇨🇳" },
  { name: "Japan", code: "JP", dial: "+81", flag: "🇯🇵" },
  { name: "United Arab Emirates", code: "AE", dial: "+971", flag: "🇦🇪" },
  { name: "Saudi Arabia", code: "SA", dial: "+966", flag: "🇸🇦" },
  { name: "Brazil", code: "BR", dial: "+55", flag: "🇧🇷" },
  { name: "Australia", code: "AU", dial: "+61", flag: "🇦🇺" },
  { name: "Singapore", code: "SG", dial: "+65", flag: "🇸🇬" },
  { name: "Switzerland", code: "CH", dial: "+41", flag: "🇨🇭" },
  { name: "Belgium", code: "BE", dial: "+32", flag: "🇧🇪" },
  { name: "Italy", code: "IT", dial: "+39", flag: "🇮🇹" },
  { name: "Spain", code: "ES", dial: "+34", flag: "🇪🇸" },
  { name: "Egypt", code: "EG", dial: "+20", flag: "🇪🇬" },
  { name: "Tanzania", code: "TZ", dial: "+255", flag: "🇹🇿" },
  { name: "Rwanda", code: "RW", dial: "+250", flag: "🇷🇼" },
];

interface PhoneInputProps {
  /** Full international phone string e.g. "+2348012345678" */
  value: string;
  /** Called with full international string */
  onChange: (value: string) => void;
  /** Error message */
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Parse a full international number into dial code + local */
function parsePhone(value: string): { dialCode: string; local: string } {
  if (!value) return { dialCode: "+234", local: "" };
  // Try to match against known dial codes (longest first)
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (value.startsWith(c.dial)) {
      return { dialCode: c.dial, local: value.slice(c.dial.length) };
    }
  }
  return { dialCode: "+234", local: value.replace(/^\+/, "") };
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, error, placeholder = "Phone number", disabled, className }, ref) => {
    const parsed = parsePhone(value);
    const [dialCode, setDialCode] = React.useState(parsed.dialCode);
    const [local, setLocal] = React.useState(parsed.local);
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    // Sync from external value changes
    React.useEffect(() => {
      const p = parsePhone(value);
      setDialCode(p.dialCode);
      setLocal(p.local);
    }, [value]);

    const selectedCountry = COUNTRIES.find(c => c.dial === dialCode) ?? COUNTRIES[0];

    const filtered = search
      ? COUNTRIES.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search)
        )
      : COUNTRIES;

    const handleDialChange = (country: Country) => {
      setDialCode(country.dial);
      setOpen(false);
      setSearch("");
      onChange(country.dial + local);
    };

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/[^0-9\s-]/g, '');
      setLocal(v);
      onChange(dialCode + v.replace(/[\s-]/g, ''));
    };

    return (
      <div className="space-y-1">
        <div className="flex">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                type="button"
                disabled={disabled}
                className={cn(
                  "rounded-r-none border-r-0 px-2.5 gap-1 min-w-[90px] justify-between font-normal",
                  error && "border-destructive"
                )}
              >
                <span>{selectedCountry.flag} {selectedCountry.dial}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="flex items-center border-b px-3 py-2">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search country..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-60">
                <div className="p-1">
                  {filtered.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer",
                        c.dial === dialCode && "bg-accent"
                      )}
                      onClick={() => handleDialChange(c)}
                    >
                      <span>{c.flag}</span>
                      <span className="flex-1 text-left">{c.name}</span>
                      <span className="text-muted-foreground">{c.dial}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">No country found</p>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <input
            ref={ref}
            type="tel"
            value={local}
            onChange={handleLocalChange}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full rounded-r-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              error && "border-destructive focus-visible:ring-destructive",
              className,
            )}
          />
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput, COUNTRIES };
