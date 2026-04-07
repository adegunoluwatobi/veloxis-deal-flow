import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

export default function ExporterPendingApproval() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardContent className="flex flex-col items-center py-10 text-center">
          <Clock className="mb-4 h-12 w-12 text-warning" />
          <h2 className="text-xl font-bold text-foreground">Onboarding Pending Approval</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your onboarding details are being reviewed. You'll gain full access once approved.
          </p>
          <Button variant="outline" className="mt-6" onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
