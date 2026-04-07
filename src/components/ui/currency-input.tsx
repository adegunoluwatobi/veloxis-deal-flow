import * as React from "react";
import { cn } from "@/lib/utils";

/** Format a numeric string with commas */
function formatWithCommas(value: string): string {
  // Remove everything except digits and decimal point
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  // Format integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
}

/** Strip commas to get raw numeric string */
export function stripCommas(value: string): string {
  return value.replace(/,/g, '');
}

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  /** The raw numeric string value (no commas) */
  value: string;
  /** Called with the raw (unformatted) numeric string */
  onChange: (rawValue: string) => void;
  /** Currency symbol/code shown as prefix label */
  currencyLabel?: string;
  /** Error message to show below the input */
  error?: string;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, currencyLabel, error, ...props }, ref) => {
    const displayValue = formatWithCommas(value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = stripCommas(e.target.value);
      // Allow only digits and one decimal point
      if (/^[0-9]*\.?[0-9]*$/.test(raw)) {
        onChange(raw);
      }
    };

    return (
      <div className="space-y-1">
        <div className="flex">
          {currencyLabel && (
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              {currencyLabel}
            </span>
          )}
          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            className={cn(
              "flex h-10 w-full border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              currencyLabel ? "rounded-r-md rounded-l-none" : "rounded-md",
              error && "border-destructive focus-visible:ring-destructive",
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
