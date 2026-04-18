import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";

const C = { deepEmerald: "#0B3D2E", accent: "#1ABC9C" };

interface LegalPageProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

function LegalPage({ title, description, children }: LegalPageProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.deepEmerald }}>
      <Helmet>
        <title>{title} — Veloxis</title>
        <meta name="description" content={description} />
      </Helmet>
      <nav className="flex items-center justify-between px-8 py-4" style={{ borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}>
        <Link to="/" className="flex items-center"><img src={veloxisLogoWhite} alt="Veloxis" className="h-9 w-auto" /></Link>
        <Link to="/" className="text-[13px] text-white/60 hover:text-white">← Back to home</Link>
      </nav>
      <main className="flex-1 px-8 py-16">
        <div className="mx-auto max-w-[680px] text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5FFFD7] mb-3">Legal</p>
          <h1 className="text-[34px] font-semibold tracking-[-0.01em] mb-4">{title}</h1>
          <p className="text-[14px] text-white/50 mb-8">Effective date: 18 April 2026 · Veloxis Ltd (Company number 15663333)</p>
          <div className="space-y-4 text-[14px] leading-[1.7] text-white/70">
            {children}
            <p>The full {title.toLowerCase()} will be published in advance of commercial launch. For questions in the meantime, contact <a href="mailto:hello@veloxis.co.uk" className="text-[#5FFFD7] hover:underline">hello@veloxis.co.uk</a>.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy policy" description="How Veloxis Ltd collects, processes, and protects personal data under UK GDPR.">
      <p>Veloxis Ltd is committed to protecting personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. This page summarises our approach.</p>
      <p>We collect only the data required to deliver our trade finance services, including company details, director identification, and transactional information necessary for KYC, AML, and underwriting purposes.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms & conditions" description="Terms and conditions governing the use of the Veloxis trade finance platform.">
      <p>Use of the Veloxis platform is subject to these terms. All transactions, including any Irrevocable Payment Undertaking or confirmed letter of credit, are governed by English law and subject to the exclusive jurisdiction of the English courts.</p>
      <p>Veloxis provides invoice discounting services to incorporated businesses introduced through approved local origination partners.</p>
    </LegalPage>
  );
}

export function Disclosure() {
  return (
    <LegalPage title="Disclosure" description="Regulatory and risk disclosures relating to the Veloxis trade finance platform.">
      <p>Invoice discounting for B2B receivables is not a regulated activity under the UK Financial Services and Markets Act 2000. Veloxis Ltd is registered in England and Wales (Company number 15663333) and operates under English law.</p>
      <p>Trade finance involves credit and operational risk. Exporters and partners should review all transaction terms carefully before participating.</p>
    </LegalPage>
  );
}

export function Cookies() {
  return (
    <LegalPage title="Cookies" description="How Veloxis uses cookies and similar technologies on its website and platform.">
      <p>Veloxis uses essential cookies to operate this website and the application platform. We do not use advertising cookies. Analytics cookies, where used, are deployed only with appropriate consent under UK PECR.</p>
    </LegalPage>
  );
}

export default Privacy;
