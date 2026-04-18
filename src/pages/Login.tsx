import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmailInput } from '@/components/ui/email-input';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';
import veloxisLogo from '@/assets/veloxis-logo-white.png';

const C = { deepEmerald: '#1a3a34', surface: '#1f4038', accent: '#2a9d8f', accentHover: '#238578' };

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setIsLoading(false);
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
      return;
    }

    // Determine role-based redirect
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setIsLoading(false); navigate('/dashboard'); return; }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authUser.id)
      .limit(1)
      .maybeSingle();

    const userRole = roleData?.role;

    if (userRole === 'exporter') {
      // Route based on onboarding status
      const { data: exp } = await supabase
        .from('exporters')
        .select('onboarding_status')
        .eq('exporter_user_id', authUser.id)
        .maybeSingle();

      const status = exp?.onboarding_status;
      setIsLoading(false);
      if (status === 'onboarding_approved') {
        navigate('/exporter');
      } else if (status === 'onboarding_submitted') {
        navigate('/exporter/pending');
      } else {
        navigate('/exporter/onboarding');
      }
    } else if (userRole === 'partner_admin' || userRole === 'partner_staff') {
      setIsLoading(false);
      navigate('/greystar');
    } else if (userRole === 'super_admin' || userRole === 'deal_manager') {
      setIsLoading(false);
      navigate('/admin');
    } else {
      setIsLoading(false);
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: C.deepEmerald }}>
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="flex flex-col items-center space-y-3 text-center">
          <a href="/" className="inline-flex items-center justify-center transition-opacity hover:opacity-80">
            <img src={veloxisLogo} alt="Veloxis" className="h-10 w-auto" />
          </a>
          <p className="text-sm font-medium tracking-wide text-white/70">Admin Panel</p>
        </div>

        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{ backgroundColor: C.surface, border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-semibold text-white">Sign in</h2>
            <p className="text-sm text-white/60">Enter your credentials to access the platform</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">Email</Label>
              <EmailInput
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-[#143029] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-offset-0"
                style={{ '--tw-ring-color': C.accent } as React.CSSProperties}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-[#143029] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-offset-0 pr-10"
                  style={{ '--tw-ring-color': C.accent } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/50 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full text-white border-0 transition-colors"
              style={{ backgroundColor: C.accent }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.accentHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = C.accent)}
              disabled={isLoading}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-white/50">
          Veloxis Ltd · UK-Registered
        </p>
      </div>
    </div>
  );
}
