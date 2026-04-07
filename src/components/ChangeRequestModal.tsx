import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export interface FlaggedField {
  field: string;
  label: string;
  note: string;
}

interface FieldDef {
  field: string;
  label: string;
}

const FIELD_SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Bank Account',
    fields: [
      { field: 'bank_name', label: 'Bank Name' },
      { field: 'bank_account_name', label: 'Account Name' },
      { field: 'bank_account_number', label: 'Account Number' },
      { field: 'bank_sort_code_iban', label: 'Sort Code / IBAN / SWIFT' },
      { field: 'bank_country', label: 'Bank Country' },
    ],
  },
  {
    title: 'Invoice',
    fields: [
      { field: 'invoice_number', label: 'Invoice Number' },
      { field: 'invoice_date', label: 'Invoice Date' },
      { field: 'invoice_value', label: 'Invoice Amount' },
      { field: 'invoice_currency_v2', label: 'Invoice Currency' },
      { field: 'payment_due_date', label: 'Payment Due Date' },
      { field: 'invoice_file_path', label: 'Invoice File' },
    ],
  },
  {
    title: 'Buyer',
    fields: [
      { field: 'buyer_company_name', label: 'Buyer Company Name' },
      { field: 'buyer_country', label: 'Buyer Country' },
      { field: 'buyer_contact_name', label: 'Buyer Contact Name' },
      { field: 'buyer_contact_email', label: 'Buyer Contact Email' },
      { field: 'buyer_contact_phone', label: 'Buyer Contact Phone' },
    ],
  },
  {
    title: 'Export',
    fields: [
      { field: 'goods_description', label: 'Goods Description' },
      { field: 'export_destination', label: 'Export Destination' },
      { field: 'export_licence_number', label: 'Export Licence Number' },
      { field: 'hs_code', label: 'HS Code' },
      { field: 'incoterms', label: 'Incoterms' },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: FlaggedField[]) => Promise<void>;
  submitting: boolean;
}

export default function ChangeRequestModal({ open, onClose, onSubmit, submitting }: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const toggle = (field: string) => {
    setSelected(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const flaggedCount = Object.values(selected).filter(Boolean).length;

  const handleSubmit = async () => {
    const fields: FlaggedField[] = [];
    for (const section of FIELD_SECTIONS) {
      for (const f of section.fields) {
        if (selected[f.field]) {
          fields.push({ field: f.field, label: f.label, note: notes[f.field] || '' });
        }
      }
    }
    await onSubmit(fields);
    setSelected({});
    setNotes({});
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Changes</DialogTitle>
          <DialogDescription>Select the fields that need updating and add instructions for the exporter.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {FIELD_SECTIONS.map(section => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-foreground mb-3">{section.title}</h3>
              <div className="space-y-3">
                {section.fields.map(f => (
                  <div key={f.field} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={f.field}
                        checked={!!selected[f.field]}
                        onCheckedChange={() => toggle(f.field)}
                      />
                      <Label htmlFor={f.field} className="text-sm cursor-pointer">{f.label}</Label>
                    </div>
                    {selected[f.field] && (
                      <Input
                        placeholder={`Instructions for ${f.label}...`}
                        value={notes[f.field] || ''}
                        onChange={e => setNotes(prev => ({ ...prev, [f.field]: e.target.value }))}
                        className="ml-6"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={flaggedCount === 0 || submitting} onClick={handleSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request Changes ({flaggedCount} field{flaggedCount !== 1 ? 's' : ''})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
