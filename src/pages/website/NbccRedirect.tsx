import { useState, FormEvent } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import veloxisLogoWhite from '@/assets/veloxis-logo-white.png';
import VeloxisHome from '@/pages/website/VeloxisHome';

const REDIRECT_URL = '/?utm_source=nbcc&utm_medium=print&utm_campaign=magazine_may2026';

export default function NbccRedirect() {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const redirect = () => window.location.replace(REDIRECT_URL);

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
    redirect();
  };

  const inputClass =
    'w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#3DE8B8] focus:border-transparent transition';

  return (
    <div className="w-full relative">
      <Helmet>
        <title>Get Early Access · Veloxis</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Homepage in background */}
      <div aria-hidden className="pointer-events-none select-none">
        <VeloxisHome />
      </div>

      {/* Modal overlay */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 overflow-y-auto bg-black/55 backdrop-blur-sm">
      <section
        className="relative my-auto w-full max-w-md overflow-hidden rounded-2xl px-4 sm:px-6 py-6 sm:py-8 flex items-center justify-center"
        style={{
          background:
            'radial-gradient(ellipse at top left, #0E5A47 0%, #0B3D2E 50%, #07231B 100%)',
        }}
      >
        {/* Background: subtle world map / trade corridors */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18] pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'><g fill='%235FFFD7'><circle cx='280' cy='320' r='3'/><circle cx='520' cy='280' r='3'/><circle cx='780' cy='340' r='3'/><circle cx='980' cy='300' r='3'/><circle cx='1220' cy='360' r='3'/><circle cx='1380' cy='420' r='3'/><circle cx='180' cy='480' r='3'/><circle cx='620' cy='560' r='3'/><circle cx='900' cy='540' r='3'/><circle cx='1120' cy='600' r='3'/></g><g fill='none' stroke='%235FFFD7' stroke-width='1' stroke-opacity='0.55' stroke-dasharray='4 6'><path d='M280 320 Q 420 220 520 280'/><path d='M520 280 Q 660 240 780 340'/><path d='M780 340 Q 880 260 980 300'/><path d='M980 300 Q 1120 280 1220 360'/><path d='M1220 360 Q 1320 380 1380 420'/><path d='M180 480 Q 380 540 620 560'/><path d='M620 560 Q 780 500 900 540'/><path d='M900 540 Q 1040 580 1120 600'/><path d='M280 320 Q 380 440 620 560'/><path d='M780 340 Q 840 460 900 540'/></g></svg>\")",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Soft mint glow accents */}
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

        {/* Faint finance grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        {/* Card */}
        <div className="relative w-full max-w-md">
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
            <h1 className="mt-4 text-2xl sm:text-3xl font-semibold text-white leading-tight">
              Stop waiting 60 days to get paid.
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/70">
              Register your interest and we'll be in touch within 24 hours.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-3">
            <input
              className={inputClass}
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
            <input
              className={inputClass}
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
            />
            <input
              className={inputClass}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className={inputClass}
              type="tel"
              placeholder="WhatsApp number"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              autoComplete="tel"
            />

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
                onClick={redirect}
                className="text-sm text-white/70 hover:text-white underline-offset-4 hover:underline"
              >
                Continue to site →
              </button>
            </div>
          </form>
        </div>

          <p className="mt-5 text-center text-[11px] uppercase tracking-[0.18em] text-white/40">
            Veloxis · UK · Funding global exporters
          </p>
        </div>
      </section>
      </div>
    </div>
  );
}
