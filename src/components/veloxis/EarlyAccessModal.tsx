import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import veloxisLogoWhite from '@/assets/veloxis-logo-white.png';

const STORAGE_KEY = 'veloxis_early_access_registered';

export function EarlyAccessModal() {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      if (window.location.pathname.startsWith('/nbcc')) return;
      if (localStorage.getItem(STORAGE_KEY) !== '1') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const close = () => setOpen(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !companyName.trim() || !email.trim() || !whatsapp.trim()) {
      setError('Please complete all fields.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    const { error: insertErr } = await supabase.from('nbcc_leads').insert({
      full_name: fullName.trim(),
      company_name: companyName.trim(),
      email: email.trim(),
      whatsapp_number: whatsapp.trim(),
    });
    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return;
    }
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setSubmitting(false);
    setOpen(false);
  };

  if (!open) return null;

  const inputClass =
    'w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#3DE8B8] focus:border-transparent transition';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 overflow-y-auto bg-black/55 backdrop-blur-sm">
      <section
        className="relative my-auto w-full max-w-md overflow-hidden rounded-2xl px-4 sm:px-6 py-6 sm:py-8"
        style={{
          background:
            'radial-gradient(ellipse at top left, #0E5A47 0%, #0B3D2E 50%, #07231B 100%)',
        }}
      >
        <div
          aria-hidden
          className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(95,255,215,0.18) 0%, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -right-32 w-[460px] h-[460px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(26,188,156,0.22) 0%, transparent 70%)' }}
        />

        <div className="relative w-full">
          <div
            className="rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl px-6 sm:px-8 py-8 sm:py-10"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
              boxShadow:
                '0 30px 80px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(95,255,215,0.06) inset',
            }}
          >
            <div className="flex justify-center mb-6">
              <img src={veloxisLogoWhite} alt="Veloxis" className="h-9 w-auto" />
            </div>

            <div className="text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider text-[#5FFFD7] border border-[#5FFFD7]/25 bg-[#5FFFD7]/5">
                Early Access · Cross-border trade finance
              </span>
              <h2 className="mt-4 text-2xl sm:text-3xl font-semibold text-white leading-tight">
                Stop waiting 60 days to get paid.
              </h2>
              <p className="mt-2 text-sm sm:text-base text-white/70">
                Register your interest and we'll be in touch within 24 hours.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-3">
              <input className={inputClass} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              <input className={inputClass} placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" />
              <input className={inputClass} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <input className={inputClass} type="tel" placeholder="WhatsApp number" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} autoComplete="tel" />

              {error && <p className="text-sm text-red-200">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md py-3 font-semibold text-[#07231B] transition-all disabled:opacity-60 hover:shadow-[0_0_24px_rgba(95,255,215,0.35)]"
                style={{ background: 'linear-gradient(135deg, #5FFFD7 0%, #1ABC9C 100%)' }}
              >
                {submitting ? 'Submitting…' : 'Get Early Access'}
              </button>

              <p className="text-center text-xs text-white/55 pt-1">
                No commitment. No obligation. Just faster cash flow.
              </p>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="text-sm text-white/70 hover:text-white underline-offset-4 hover:underline"
                >
                  Continue to site →
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
