import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import { maskTail } from '@/v2/lib/onboardingRules';

export function Field({ label, children, error, hint, className = '' }: {
  label: string; children: React.ReactNode; error?: string | null; hint?: string; className?: string;
}) {
  return (
    <div className={`space-y-1 ${error ? '[&_input]:border-destructive [&_button]:border-destructive' : ''} ${className}`} data-invalid={error ? 'true' : undefined}>
      <Label className={`text-xs ${error ? 'text-destructive' : ''}`}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive flex items-start gap-1"><AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{error}</p>}
    </div>
  );
}

/** Shows only the last 4 characters once the field loses focus. */
export function SensitiveInput({ value, onChange, onBlur, maxLength, inputMode = 'numeric', disabled }: {
  value: string; onChange: (v: string) => void; onBlur?: () => void; maxLength?: number;
  inputMode?: 'numeric' | 'text'; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Input
      value={focused ? value : maskTail(value)}
      inputMode={inputMode}
      maxLength={maxLength}
      autoComplete="off"
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      onChange={(e) => onChange(inputMode === 'numeric' ? e.target.value.replace(/\D/g, '') : e.target.value)}
    />
  );
}

export function MultiSelect({ value, onChange, options, placeholder = 'Select…' }: {
  value: string[]; onChange: (v: string[]) => void; options: readonly string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal h-auto min-h-10">
          <span className={`text-left whitespace-normal ${value.length ? '' : 'text-muted-foreground'}`}>
            {value.length ? value.join(', ') : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search banks…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => toggle(o)}>
                  <Check className={`mr-2 h-4 w-4 ${value.includes(o) ? 'opacity-100' : 'opacity-0'}`} />{o}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function Section({ title, children, description }: { title: string; children: React.ReactNode; description?: string }) {
  return (
    <section className="card-elevated p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}
