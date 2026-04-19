import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DIAL_COUNTRIES } from "@/lib/countriesDial";

interface CountrySelectProps {
  /** Stored value: country name (e.g. "Nigeria"). Empty string for unselected. */
  value: string;
  onChange: (countryName: string) => void;
  /** Optional id for label + scroll-to-error targeting */
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When true, show flag emoji next to country name */
  showFlag?: boolean;
}

/**
 * Reusable searchable country dropdown. Stores the country **name** as the value
 * (matches existing free-text columns like registered_country, trading_country,
 * bank_country). Themed via design tokens.
 */
export function CountrySelect({
  value,
  onChange,
  id,
  placeholder = "Select country",
  disabled,
  className,
  showFlag = true,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);

  const selected = DIAL_COUNTRIES.find(
    (c) => c.name.toLowerCase() === (value ?? "").toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selected ? (
              <>
                {showFlag && <span className="mr-2">{selected.flag}</span>}
                {selected.name}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {DIAL_COUNTRIES.map((c) => (
                <CommandItem
                  key={c.iso}
                  value={c.name}
                  onSelect={(currentValue) => {
                    // CommandItem lower-cases the value; map back to canonical name.
                    const match = DIAL_COUNTRIES.find(
                      (x) => x.name.toLowerCase() === currentValue.toLowerCase()
                    );
                    onChange(match?.name ?? c.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected?.iso === c.iso ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {showFlag && <span className="mr-2">{c.flag}</span>}
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
