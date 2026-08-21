import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';

export type SearchOption = { value: string; label: string; hint?: string };

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Search',
  emptyText = 'Nothing found.',
  disabled,
  extraItem,
}: {
  value?: string | null;
  onChange: (v: string) => void;
  options: SearchOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  extraItem?: { value: string; label: string };
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? (extraItem && value === extraItem.value ? extraItem.label : null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="w-full justify-between font-normal">
          <span className={label ? '' : 'text-muted-foreground'}>{label ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ''} ${o.value}`}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                >
                  <span>{o.label}</span>
                  {o.hint && <span className="ml-2 text-xs text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
              {extraItem && (
                <CommandItem
                  value={extraItem.label}
                  onSelect={() => { onChange(extraItem.value); setOpen(false); }}
                >
                  {extraItem.label}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */

export function useCountries() {
  const [rows, setRows] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    supabase.from('countries').select('code, name').eq('active', true).order('name')
      .then(({ data }) => setRows((data ?? []) as any));
  }, []);
  return rows;
}

export function CountrySelect({
  value, onChange, placeholder = 'Search countries', disabled,
}: { value?: string | null; onChange: (code: string) => void; placeholder?: string; disabled?: boolean }) {
  const rows = useCountries();
  const options = useMemo(
    () => rows.map((c) => ({ value: c.code, label: c.name, hint: c.code })),
    [rows],
  );
  return <SearchSelect value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} emptyText="No country found." />;
}

/* ------------------------------------------------------------------ */

export const PORT_NOT_LISTED = '__other__';

export function usePorts() {
  const [rows, setRows] = useState<{ unlocode: string; name: string; country_code: string; type: string }[]>([]);
  useEffect(() => {
    supabase.from('ports').select('unlocode, name, country_code, type').eq('active', true).order('name')
      .then(({ data }) => setRows((data ?? []) as any));
  }, []);
  return rows;
}

export function PortSelect({
  value, otherValue, onChange, onOtherChange, label, disabled,
}: {
  value: string;
  otherValue: string;
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const ports = usePorts();
  const countries = useCountries();
  const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;
  const options = useMemo(
    () => ports.map((p) => ({ value: p.unlocode, label: p.name, hint: `${countryName(p.country_code)} · ${p.unlocode}` })),
    [ports, countries],
  );

  return (
    <div className="space-y-2">
      <SearchSelect
        value={value}
        onChange={(v) => { onChange(v); if (v !== PORT_NOT_LISTED) onOtherChange(''); }}
        options={options}
        placeholder={`Search ${label.toLowerCase()}`}
        emptyText="No port found."
        disabled={disabled}
        extraItem={{ value: PORT_NOT_LISTED, label: 'Not listed' }}
      />
      {value === PORT_NOT_LISTED && (
        <div className="space-y-1">
          <Input
            placeholder="Type the port name"
            value={otherValue}
            onChange={(e) => onOtherChange(e.target.value)}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">We will confirm this port with you during review.</p>
        </div>
      )}
    </div>
  );
}
