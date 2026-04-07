import * as React from "react";
import { cn } from "@/lib/utils";

function isValidEmail(email: string): boolean {
  if (!email) return true; // empty is not invalid, just required
  const atIndex = email.indexOf("@");
  if (atIndex < 1) return false;
  const afterAt = email.slice(atIndex + 1);
  return afterAt.includes(".") && afterAt.indexOf(".") < afterAt.length - 1;
}

interface EmailInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string;
  /** Called with validation state on blur */
  onValidationChange?: (isValid: boolean) => void;
}

const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  ({ className, error: externalError, onValidationChange, onBlur, onChange, value, ...props }, ref) => {
    const [touched, setTouched] = React.useState(false);
    const [internalError, setInternalError] = React.useState("");

    const validate = (val: string) => {
      if (val && !isValidEmail(val)) {
        setInternalError("Please enter a valid email address");
        onValidationChange?.(false);
      } else {
        setInternalError("");
        onValidationChange?.(true);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      validate(e.target.value);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Clear error as user types
      if (internalError && isValidEmail(e.target.value)) {
        setInternalError("");
        onValidationChange?.(true);
      }
      onChange?.(e);
    };

    const displayError = externalError || (touched ? internalError : "");

    return (
      <div className="space-y-1">
        <input
          ref={ref}
          type="email"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            displayError && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          {...props}
        />
        {displayError && <p className="text-sm font-medium text-destructive">{displayError}</p>}
      </div>
    );
  },
);
EmailInput.displayName = "EmailInput";

export { EmailInput, isValidEmail };
