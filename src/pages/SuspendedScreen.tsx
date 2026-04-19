import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import veloxisLogo from '@/assets/veloxis-logo-white.png';

export default function SuspendedScreen() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: '#1a3a34' }}>
      <Helmet><title>Account Suspended · Veloxis</title></Helmet>
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <img src={veloxisLogo} alt="Veloxis" className="h-10 w-auto" />
        </div>
        <div className="rounded-2xl p-8 shadow-2xl text-left" style={{ backgroundColor: '#1f4038', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-full bg-destructive/20 p-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <h1 className="text-lg font-semibold text-white">Account suspended</h1>
          </div>
          <p className="text-sm text-white/70 mb-6">
            Your account has been suspended. Contact <a href="mailto:support@veloxis.co.uk" className="underline" style={{ color: '#0BA4A4' }}>support@veloxis.co.uk</a>.
          </p>
          <Button onClick={handleSignOut} variant="outline" className="w-full bg-transparent border-white/20 text-white hover:bg-white/10">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
