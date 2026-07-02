import { Helmet } from "react-helmet";
import { Navbar } from "@/components/veloxis/Navbar";
import { Footer } from "@/components/veloxis/Footer";

interface Props {
  slug: "privacy" | "terms" | "disclosure" | "cookies";
}

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

interface Section {
  h: string;
  blocks: Block[];
}

interface PageContent {
  title: string;
  updated: string;
  intro?: string;
  sections: Section[];
  closing?: string;
}

const CONTENT: Record<Props["slug"], PageContent> = {
  privacy: {
    title: "Privacy Policy",
    updated: "Last updated 18 April 2026",
    sections: [
      {
        h: "1. Who we are",
        blocks: [
          { type: "p", text: "Veloxis Ltd is the data controller for the personal data described in this policy." },
          {
            type: "ul",
            items: [
              "Company name: Veloxis Ltd",
              "Company number: 15663333",
              "Office: Exeter Business Park, 1 Emperor Way, Exeter, EX1 3QS",
              "Email for privacy queries: privacy@veloxis.co.uk",
            ],
          },
        ],
      },
      {
        h: "2. What data we collect",
        blocks: [
          {
            type: "p",
            text: "We may collect: identity data (name, job title, company name); contact data (email, phone, postal address); business information (company registration details, EORI numbers, trade references, buyer details); application data (invoices, transaction history, deal documentation); technical data (IP address, browser type, device identifiers, time zone, approximate location); usage data (how you navigate our website or platform).",
          },
        ],
      },
      {
        h: "3. How we use personal data",
        blocks: [
          {
            type: "p",
            text: "We use personal data to: assess and process applications; verify identities and carry out KYC, AML and sanctions screening; operate and improve our website and platform; communicate with you about applications, services and updates; meet our legal and regulatory obligations including record-keeping, fraud prevention and reporting.",
          },
        ],
      },
      {
        h: "4. Legal bases for processing",
        blocks: [
          {
            type: "ul",
            items: [
              "Contract: where processing is necessary to consider and provide our services.",
              "Legal obligation: for compliance with AML, sanctions and tax rules.",
              "Legitimate interests: for running and improving our business and preventing fraud.",
              "Consent: for certain marketing communications and cookies. You may withdraw consent at any time.",
            ],
          },
        ],
      },
      {
        h: "5. How we share data",
        blocks: [
          {
            type: "p",
            text: "We may share personal data with service providers, banks and financial institutions involved in a transaction, professional advisers, and regulators or authorities where required by law. We do not sell personal data to third parties.",
          },
        ],
      },
      {
        h: "6. International transfers",
        blocks: [
          {
            type: "p",
            text: "Where service providers are outside the UK, we only transfer data where appropriate safeguards exist, such as standard contractual clauses or an adequacy decision.",
          },
        ],
      },
      {
        h: "7. Data retention",
        blocks: [
          {
            type: "p",
            text: "We keep personal data only as long as necessary for the purposes set out in this policy, including meeting legal, accounting and reporting obligations.",
          },
        ],
      },
      {
        h: "8. Your rights",
        blocks: [
          {
            type: "p",
            text: "Under UK data protection law you have the right to: access your personal data; correct inaccurate data; request erasure in certain circumstances; restrict or object to certain processing; data portability in some cases; withdraw consent at any time; and complain to the ICO (www.ico.org.uk). To exercise any right contact privacy@veloxis.co.uk.",
          },
        ],
      },
      {
        h: "9. Security",
        blocks: [
          {
            type: "p",
            text: "We use appropriate technical and organisational measures to protect personal data. No system is completely secure and we cannot guarantee absolute security.",
          },
        ],
      },
      {
        h: "10. Updates",
        blocks: [
          {
            type: "p",
            text: "We may update this policy from time to time. The latest version will always be available on our website with an updated date.",
          },
        ],
      },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    updated: "Last updated 18 April 2026",
    sections: [
      {
        h: "1. Who we are",
        blocks: [
          {
            type: "p",
            text: "Veloxis Ltd (Company number 15663333). Registered in England and Wales. Registered office: Exeter Business Park, 1 Emperor Way, Exeter, EX1 3QS, United Kingdom.",
          },
        ],
      },
      {
        h: "2. Use of this website",
        blocks: [
          {
            type: "p",
            text: "You may use this website for lawful purposes only. You must not use the site in any way that: breaches applicable local, national or international law; is fraudulent or has any fraudulent purpose or effect; infringes the rights of any other person; or introduces viruses or other harmful material. We do not guarantee the website will always be available or uninterrupted.",
          },
        ],
      },
      {
        h: "3. No offer of finance or advice",
        blocks: [
          {
            type: "p",
            text: "Nothing on this website constitutes an offer, recommendation or commitment by Veloxis to provide finance, or financial, legal or tax advice. Any decision to enter into a transaction with Veloxis should be based on your own independent assessment.",
          },
        ],
      },
      {
        h: "4. Account security",
        blocks: [
          {
            type: "p",
            text: "You must keep login credentials confidential and notify us immediately if you suspect unauthorised access. You are responsible for all activity under your account.",
          },
        ],
      },
      {
        h: "5. Intellectual property",
        blocks: [
          {
            type: "p",
            text: "We or our licensors own all intellectual property rights in this website and its content. You may print or download extracts for personal or internal business use only. You must not use any content commercially without our prior written consent.",
          },
        ],
      },
      {
        h: "6. Liability",
        blocks: [
          {
            type: "p",
            text: "To the fullest extent permitted by law, we exclude all implied warranties and will not be liable for any loss of profit, revenue, goodwill, data, or indirect or consequential loss. Nothing limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded under English law.",
          },
        ],
      },
      {
        h: "7. Third-party sites",
        blocks: [
          {
            type: "p",
            text: "Links to third-party websites are for information only. We have no control over and accept no responsibility for their content or availability.",
          },
        ],
      },
      {
        h: "8. Changes",
        blocks: [
          {
            type: "p",
            text: "We may update these Terms from time to time. Continued use of the website after changes are posted constitutes your acceptance of the updated Terms.",
          },
        ],
      },
      {
        h: "9. Governing law",
        blocks: [
          {
            type: "p",
            text: "These Terms are governed by English law. The courts of England and Wales have exclusive jurisdiction.",
          },
        ],
      },
    ],
  },
  cookies: {
    title: "Cookies Policy",
    updated: "Last updated 18 April 2026",
    sections: [
      {
        h: "1. What are cookies?",
        blocks: [
          {
            type: "p",
            text: "Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work, improve user experience and provide information to site owners.",
          },
        ],
      },
      {
        h: "2. Types of cookies we use",
        blocks: [
          {
            type: "ul",
            items: [
              "Strictly necessary cookies: required for core site functions such as security and navigation. These do not require your consent.",
              "Analytics cookies: help us understand how visitors use our site so we can improve performance and content.",
              "Functionality cookies: allow the site to remember your preferences such as language or region.",
              "Marketing cookies: used to measure the effectiveness of campaigns where applicable.",
            ],
          },
        ],
      },
      {
        h: "3. Cookie consent",
        blocks: [
          {
            type: "p",
            text: "When you first visit our site we display a cookie banner. Except for strictly necessary cookies, we will only set cookies if you consent. You can accept all, reject non-essential, or manage settings to choose which categories you allow. You can change your preferences at any time via the cookie settings link in the footer.",
          },
        ],
      },
      {
        h: "4. Managing cookies in your browser",
        blocks: [
          {
            type: "p",
            text: "You can block or delete cookies using your browser settings. Doing so may affect how our website functions.",
          },
        ],
      },
      {
        h: "5. Third-party cookies",
        blocks: [
          {
            type: "p",
            text: "Some cookies may be set by third-party services such as analytics providers. We do not control these. Please refer to the relevant third party's website for more information.",
          },
        ],
      },
      {
        h: "6. Changes",
        blocks: [
          {
            type: "p",
            text: "We may update this policy from time to time. The latest version will always be available on this page.",
          },
        ],
      },
    ],
    closing: "Questions? Contact privacy@veloxis.co.uk",
  },
  disclosure: {
    title: "Disclosure",
    updated: "Last updated 18 April 2026",
    sections: [
      {
        h: "1. Regulatory status",
        blocks: [
          {
            type: "p",
            text: "Veloxis operates as a business-to-business invoice discounting entity that purchases trade receivables from exporters. Invoice discounting of B2B receivables is not a regulated activity under the UK Financial Services and Markets Act 2000 and sits outside the FCA regulatory perimeter. Veloxis Ltd (Company number 15663333) is registered in England and Wales and operates under English law.",
          },
        ],
      },
      {
        h: "2. Transaction structure",
        blocks: [
          {
            type: "p",
            text: "Each transaction is a true sale of a receivable. Before funds are released, the underlying buyer either signs an Irrevocable Payment Undertaking with Veloxis or arranges a confirmed letter of credit from their bank.",
          },
        ],
      },
      {
        h: "3. AML and KYC",
        blocks: [
          {
            type: "p",
            text: "We follow UK anti-money-laundering and know-your-customer standards in partnership with our in-country origination partners.",
          },
        ],
      },
      {
        h: "4. Indicative pricing",
        blocks: [
          {
            type: "p",
            text: "Advance rate: 80% of invoice value. Platform fee: 1% (one-off, waived on Veloxis Pro). Discount fee: 2% per month. Late penalty: 0.067% per day. Payment terms: 30 to 60 days. Indicative only; actual pricing is set per transaction at underwriting.",
          },
        ],
      },
    ],
  },
};

const TEAL = "#2a9d8f";
const DEEP_EMERALD = "#0B3D2E";

export default function LegalPage({ slug }: Props) {
  const c = CONTENT[slug];
  const description = c.sections[0]?.blocks[0] && c.sections[0].blocks[0].type === "p"
    ? c.sections[0].blocks[0].text.slice(0, 155)
    : `${c.title} for Veloxis Ltd.`;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Helmet>
        <title>{c.title} — Veloxis</title>
        <meta name="description" content={description} />
      </Helmet>

      <Navbar />

      {/* Hero */}
      <section style={{ background: DEEP_EMERALD }} className="px-8 py-16 md:py-20">
        <div className="mx-auto max-w-[780px]">
          <span
            className="inline-block text-[11px] font-medium uppercase tracking-[0.12em] px-3 py-1 rounded-full"
            style={{ background: "rgba(42,157,143,0.18)", color: "#5FFFD7", border: "0.5px solid rgba(95,255,215,0.25)" }}
          >
            Legal
          </span>
          <h1 className="mt-5 text-[40px] md:text-[48px] font-semibold tracking-[-0.02em] text-white leading-[1.05]">
            {c.title}
          </h1>
          <p className="mt-3 text-[14px] text-white/60">{c.updated}</p>
        </div>
      </section>

      {/* Body card */}
      <main className="flex-1 px-4 md:px-8 py-12 md:py-16 bg-[#f9fafb]">
        <article className="mx-auto max-w-[780px] bg-white rounded-2xl shadow-sm border border-[#e5e7eb] p-8 md:p-12">
          {c.intro && (
            <p className="text-[15px] leading-[1.7] text-[#374151] mb-8">{c.intro}</p>
          )}

          <div className="space-y-9">
            {c.sections.map((s) => (
              <section key={s.h}>
                <h2
                  className="text-[18px] md:text-[20px] font-semibold mb-3"
                  style={{ color: DEEP_EMERALD }}
                >
                  {s.h}
                </h2>
                <div className="space-y-3">
                  {s.blocks.map((b, i) =>
                    b.type === "p" ? (
                      <p key={i} className="text-[14.5px] leading-[1.75] text-[#374151]">
                        {b.text}
                      </p>
                    ) : (
                      <ul key={i} className="space-y-2">
                        {b.items.map((item) => (
                          <li key={item} className="flex gap-3 text-[14.5px] leading-[1.7] text-[#374151]">
                            <span
                              aria-hidden
                              className="mt-[9px] inline-block h-[6px] w-[6px] rounded-full shrink-0"
                              style={{ background: TEAL }}
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </section>
            ))}
          </div>

          {c.closing && (
            <p className="mt-10 pt-6 border-t border-[#e5e7eb] text-[14px] text-[#6b7280]">
              {c.closing}
            </p>
          )}
        </article>
      </main>

      <Footer />
    </div>
  );
}
