import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";

const C = { deepEmerald: "#0B3D2E" };

interface Props {
  slug: "privacy" | "terms" | "disclosure" | "cookies";
}

const CONTENT: Record<Props["slug"], { title: string; intro: string; sections: { h: string; p: string }[] }> = {
  privacy: {
    title: "Privacy policy",
    intro:
      "Veloxis Ltd (Company number 15663333) is the controller of personal data processed through this website and the Veloxis platform. This page explains what we collect, why we collect it, and your rights under UK GDPR and the Data Protection Act 2018.",
    sections: [
      { h: "What we collect", p: "Identity and contact details you provide on application forms; KYC documents collected via our local origination partners; trade documents (invoices, bills of lading, IPUs); usage and device data necessary to operate the platform securely." },
      { h: "Why we use it", p: "To provide trade finance services; verify identity and meet anti-money-laundering obligations; underwrite buyer risk; settle funds; and meet our legal and regulatory duties under English law." },
      { h: "Who we share it with", p: "Our origination partners (limited to data needed for KYC and onboarding), buyer-facing counterparties (limited to data necessary to issue an IPU or LC), payment service providers, professional advisers, and competent authorities where required by law." },
      { h: "Retention", p: "We retain personal data for the period required to deliver services and meet our legal record-keeping obligations (typically six years from the end of the customer relationship)." },
      { h: "Your rights", p: "You have the right to access, correct, delete, restrict, or port your personal data, and to object to certain processing. Contact hello@veloxis.co.uk to exercise any of these rights. You can also complain to the Information Commissioner's Office (ico.org.uk)." },
    ],
  },
  terms: {
    title: "Terms and conditions",
    intro:
      "These terms govern your use of the Veloxis website and platform. By using the platform you agree to these terms. Veloxis Ltd (Company number 15663333) is registered in England and Wales and operates under English law.",
    sections: [
      { h: "Eligibility", p: "The Veloxis platform is for incorporated businesses onboarded through a Veloxis-approved local partner. Individual consumers are not eligible." },
      { h: "Service description", p: "Veloxis is a cross-border invoice discounting platform. We purchase eligible receivables at a discount, subject to underwriting and a buyer-signed Irrevocable Payment Undertaking (IPU) or confirmed letter of credit." },
      { h: "Acceptable use", p: "You agree not to misuse the platform, attempt unauthorised access, or upload material that is unlawful or infringes third-party rights." },
      { h: "Liability", p: "Nothing in these terms excludes liability that cannot be excluded under English law. To the extent permitted, our liability for any claim is limited to the fees paid for the relevant transaction." },
      { h: "Governing law", p: "These terms and any non-contractual disputes are governed by the laws of England and Wales." },
    ],
  },
  disclosure: {
    title: "Disclosure",
    intro:
      "Veloxis Ltd (Company number 15663333) is registered in England and Wales. This page sets out our regulatory position and how transactions are structured.",
    sections: [
      { h: "Regulatory status", p: "Invoice discounting for B2B receivables is not a regulated activity under the UK Financial Services and Markets Act 2000. Veloxis Ltd operates under English law." },
      { h: "Transaction structure", p: "Each transaction is a true sale of a receivable. Before funds are released, the underlying buyer either signs an Irrevocable Payment Undertaking with Veloxis or arranges a confirmed letter of credit from their bank." },
      { h: "AML and KYC", p: "We follow UK anti-money-laundering and know-your-customer standards in partnership with our in-country origination partners." },
      { h: "Indicative pricing", p: "Advance rate: 80% of invoice value. Platform fee: 1% (one-off, waived on Veloxis Pro). Discount fee: 2% per month. Late penalty: 0.067% per day. Payment terms: 30 to 60 days. Indicative only; actual pricing is set per transaction at underwriting." },
    ],
  },
  cookies: {
    title: "Cookies policy",
    intro:
      "This page explains how Veloxis uses cookies and similar technologies on our website and platform.",
    sections: [
      { h: "Strictly necessary", p: "Cookies that authenticate your session and keep the platform secure. These cannot be turned off." },
      { h: "Performance and analytics", p: "Aggregated, non-identifying analytics that help us understand site usage and improve the product." },
      { h: "Managing cookies", p: "You can clear or block cookies through your browser settings. Blocking strictly necessary cookies will break sign-in and core platform features." },
      { h: "Contact", p: "Questions about cookies? Email hello@veloxis.co.uk." },
    ],
  },
};

export default function LegalPage({ slug }: Props) {
  const c = CONTENT[slug];
  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.deepEmerald }}>
      <Helmet>
        <title>{c.title} — Veloxis</title>
        <meta name="description" content={c.intro.slice(0, 155)} />
      </Helmet>
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-8 py-3 backdrop-blur-md"
        style={{ background: "rgba(11,61,46,0.85)", borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}
      >
        <Link to="/" className="cursor-pointer flex items-center gap-0">
          <img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" />
        </Link>
        <Link to="/" className="text-[13px] font-medium text-white/50 hover:text-white transition-colors">
          ← Home
        </Link>
      </nav>

      <main className="flex-1 mx-auto max-w-[760px] w-full px-8 py-16">
        <h1 className="text-[42px] font-semibold tracking-[-0.02em] text-white mb-4">{c.title}</h1>
        <p className="text-[15px] text-white/60 leading-[1.7] mb-10">{c.intro}</p>

        <div className="space-y-8">
          {c.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-[18px] font-semibold text-white mb-2">{s.h}</h2>
              <p className="text-[14px] text-white/60 leading-[1.7]">{s.p}</p>
            </section>
          ))}
        </div>

        <p className="mt-12 text-[12px] text-white/35">
          Last updated 18 April 2026. Veloxis Ltd (Company number 15663333). Registered in England and Wales.
          Questions? <a href="mailto:hello@veloxis.co.uk" className="text-[#5FFFD7] hover:underline">hello@veloxis.co.uk</a>
        </p>
      </main>

      <footer
        className="px-8 py-4 text-center"
        style={{ background: "#071f1d", borderTop: "0.5px solid rgba(26,188,156,0.08)" }}
      >
        <p className="text-[12px] text-white/30">
          © 2026 Veloxis Ltd (Company number 15663333). Registered in England and Wales.
        </p>
      </footer>
    </div>
  );
}
