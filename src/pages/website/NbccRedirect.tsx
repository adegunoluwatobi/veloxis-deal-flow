import { useState, FormEvent } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import veloxisLogoWhite from '@/assets/veloxis-logo-white.png';

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
    'w-full rounded-md bg-white/10 border border-white/20 px-3 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#3DE8B8] focus:border-transparent';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: '#0F6E56' }}
    >
      <Helmet>
        <title>Get Early Access · Veloxis</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="w-full max-w-md text-white py-8">
        <div className="flex justify-center mb-8">
          <img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" />
        </div>
        <h1 className="text-3xl font-semibold text-center leading-tight">
          Stop waiting 60 days to get paid.
        </h1>
        <p className="mt-3 text-center text-white/80">
          Register your interest and we'll be in touch within 24 hours.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
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
            className="w-full rounded-md py-3 font-semibold text-[#0F6E56] transition-opacity disabled:opacity-60 hover:opacity-90"
            style={{ backgroundColor: '#3DE8B8' }}
          >
            {submitting ? 'Submitting…' : 'Get Early Access'}
          </button>

          <p className="text-center text-xs text-white/60 pt-1">
            No commitment. No obligation. Just faster cash flow.
          </p>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={redirect}
              className="text-sm text-white/80 hover:text-white underline-offset-4 hover:underline"
            >
              Continue to site →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
