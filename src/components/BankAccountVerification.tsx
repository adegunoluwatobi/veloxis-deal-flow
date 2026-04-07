import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { CreditCard, CheckCircle2, Upload, ShieldCheck, AlertTriangle } from 'lucide-react';

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  sort_code_iban: string;
  bank_country: string;
  account_currency?: string;
  swift_bic?: string;
  is_verified?: boolean;
  verified_at?: string;
  proof_document_path?: string;
  is_default: boolean;
}

interface Props {
  exporterId: string;
  isVeloxis: boolean;
  onReload?: () => void;
}

const ACCOUNT_CURRENCIES = ['USD', 'GBP', 'EUR'] as const;

export default function BankAccountVerification({ exporterId, isVeloxis, onReload }: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<Record<string, File | null>>({});

  const isSuperAdminOrDM = role === 'super_admin' || role === 'deal_manager';

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('exporter_bank_accounts')
      .select('*')
      .eq('exporter_id', exporterId)
      .order('is_default', { ascending: false });
    setAccounts((data as BankAccount[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAccounts(); }, [exporterId]);

  const handleUpdateAccount = async (accountId: string, updates: Record<string, unknown>) => {
    setSavingId(accountId);
    try {
      const { error } = await supabase
        .from('exporter_bank_accounts')
        .update(updates as any)
        .eq('id', accountId);
      if (error) throw error;
      toast({ title: 'Bank account updated' });
      await loadAccounts();
      onReload?.();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Update failed', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const handleVerify = async (accountId: string) => {
    if (!user) return;
    await handleUpdateAccount(accountId, {
      is_verified: true,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
    });
  };

  const handleUploadProof = async (accountId: string) => {
    const file = proofFiles[accountId];
    if (!file || !user) return;
    setUploadingId(accountId);
    try {
      const filePath = `exporters/${exporterId}/bank_proof_${Date.now()}_${sanitiseFilename(file.name)}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, file);
      if (storageErr) throw storageErr;

      const { error } = await supabase
        .from('exporter_bank_accounts')
        .update({ proof_document_path: filePath } as any)
        .eq('id', accountId);
      if (error) throw error;

      setProofFiles(prev => ({ ...prev, [accountId]: null }));
      toast({ title: 'Bank proof document uploaded' });
      await loadAccounts();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) return null;
  if (accounts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Domiciliary Bank Accounts</CardTitle>
        </div>
        <CardDescription>Bank account verification is required before any disbursement can be made.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.map(account => (
          <div key={account.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{account.bank_name}</span>
                {account.is_default && <Badge variant="outline" className="text-xs">Default</Badge>}
                {account.is_verified ? (
                  <Badge variant="secondary" className="bg-success/10 text-success text-xs gap-1">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-warning/10 text-warning text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" /> Unverified
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Account Name</span>
                <p className="font-medium text-foreground">{account.account_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Account Number</span>
                <p className="font-medium text-foreground">{account.account_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sort Code / IBAN</span>
                <p className="font-medium text-foreground">{account.sort_code_iban}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Country</span>
                <p className="font-medium text-foreground">{account.bank_country}</p>
              </div>
            </div>

            {/* Currency & SWIFT fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Account Currency</Label>
                {!account.is_verified ? (
                  <Select
                    value={account.account_currency ?? 'USD'}
                    onValueChange={v => handleUpdateAccount(account.id, { account_currency: v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_CURRENCIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium text-foreground">{account.account_currency ?? 'USD'}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">SWIFT / BIC Code</Label>
                {!account.is_verified ? (
                  <Input
                    value={account.swift_bic ?? ''}
                    onChange={e => {
                      const idx = accounts.findIndex(a => a.id === account.id);
                      const updated = [...accounts];
                      updated[idx] = { ...updated[idx], swift_bic: e.target.value };
                      setAccounts(updated);
                    }}
                    onBlur={() => {
                      if (account.swift_bic) {
                        handleUpdateAccount(account.id, { swift_bic: account.swift_bic });
                      }
                    }}
                    placeholder="e.g. FBNINGLA"
                    className="h-8"
                  />
                ) : (
                  <p className="text-sm font-medium text-foreground">{account.swift_bic ?? '—'}</p>
                )}
              </div>
            </div>

            {/* Proof document upload */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Proof of Account (bank confirmation letter)</Label>
              {account.proof_document_path ? (
                <div className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Proof document uploaded
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setProofFiles(prev => ({ ...prev, [account.id]: e.target.files?.[0] ?? null }))}
                    className="flex-1 h-8"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUploadProof(account.id)}
                    disabled={!proofFiles[account.id] || uploadingId === account.id}
                    className="h-8"
                  >
                    <Upload className="mr-1 h-3 w-3" /> {uploadingId === account.id ? 'Uploading…' : 'Upload'}
                  </Button>
                </div>
              )}
            </div>

            {/* Veloxis verify action */}
            {isSuperAdminOrDM && !account.is_verified && (
              <Button
                size="sm"
                onClick={() => handleVerify(account.id)}
                disabled={savingId === account.id}
                className="gap-1"
              >
                <ShieldCheck className="h-3 w-3" />
                {savingId === account.id ? 'Verifying…' : 'Verify Bank Account'}
              </Button>
            )}

            {account.is_verified && account.verified_at && (
              <p className="text-xs text-muted-foreground">
                Verified on {new Date(account.verified_at).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
