import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "What is trade finance?",
    a: "Trade finance is a form of export trade finance where a financier advances funds against a verified trade receivable created by your shipment. Veloxis is not a lender. We advance 80% of your invoice value within 24 hours of verification, and release the residual balance once your buyer pays at maturity — minus a transparent fee. Every transaction is protected by three layers of security: independent physical verification of the commodity before shipment, a formal assignment of proceeds backed by an irrevocable Letter of Credit or Irrevocable Payment Undertaking from a UK or top-20 global bank under UCP 600, and controlled settlement through dedicated domiciliary accounts.",
  },
  {
    q: "Who can use Veloxis?",
    a: "Veloxis is for incorporated businesses anywhere in the world that export goods to verified buyers in the UK or EU. You must be onboarded through a Veloxis-approved local partner. Sole traders and unregistered partnerships are not eligible.",
  },
  {
    q: "What documents do I need?",
    a: "At company level, uploaded once via your local partner: Certificate of Incorporation or equivalent, Director ID, and Export Authority document. Per deal: Commercial Invoice, Bill of Lading or Airway Bill, and Customs Export Declaration. Your partner will guide you through the exact requirements for your country.",
  },
  {
    q: "What is an Irrevocable Payment Undertaking (IPU)?",
    a: "The IPU is the legal instrument at the heart of every Veloxis transaction. Before funds are released, your buyer signs a formal undertaking committing to pay Veloxis directly on the invoice due date. No signed IPU means no funds released — it is the core protection for all parties.",
  },
  {
    q: "How long does approval take?",
    a: "A complete application — all documents uploaded, KYC verified by your partner, buyer details confirmed — is reviewed within 24 hours. The IPU is sent to your buyer immediately on approval. Once your buyer signs, funds are released typically within the same business day.",
  },
  {
    q: "Do I need a UK bank account?",
    a: "No. Veloxis settles funds directly to your domiciliary account in your home country. You do not need a UK or EU bank account. This is one of the key reasons the platform was built — to serve exporters excluded precisely because of this barrier.",
  },
  {
    q: "What goods are eligible?",
    a: "Veloxis finances all legal export goods, including solid minerals, metals and scrap, manufactured goods, textiles, processed chemicals, timber and wood products, seafood, and agricultural and perishable produce shipped under standard trade terms. The only exclusions are weapons, controlled substances, and any goods prohibited under UK sanctions or applicable export controls.",
  },
  {
    q: "Is Veloxis a lender?",
    a: "No. Veloxis is a financier in an trade finance transaction — we advance funds against your trade receivable at a discount. We are buying an asset, not extending a loan. No debt appears on your balance sheet and there is no loan agreement to service. The model is self-liquidating: settlement comes directly from the buyer's bank under the Letter of Credit or IPU.",
  },
  {
    q: "What if my buyer does not pay?",
    a: "The IPU creates a direct legal obligation between your buyer and Veloxis. If a buyer defaults, Veloxis pursues recovery directly. Your liability as an exporter is limited to the accuracy and authenticity of the trade documents you submitted.",
  },
  {
    q: "Can I use Veloxis for multiple invoices?",
    a: "Yes. Once your KYC is verified and your profile is set up, submitting subsequent deals is significantly faster — you only need the trade documents specific to each shipment. Many exporters use Veloxis on a rolling basis across multiple buyers and shipment cycles.",
  },
];

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-[960px] px-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#0d9488] mb-2">FAQ</p>
        <h2 className="text-[34px] font-medium leading-[1.2] text-[#111827]">
          Everything you need to know.
        </h2>
        <p className="mt-3 text-[14px] text-[#6b7280] mb-2">
          Still have questions?{" "}
          <a href="mailto:hello@veloxis.co.uk" className="text-[#0d9488] hover:underline">hello@veloxis.co.uk</a>
        </p>
        <p className="text-[12px] text-[#9ca3af] mb-7">
          Veloxis Ltd · 1 Emperor Way, Exeter Business Park, Exeter, EX1 3QS, United Kingdom
        </p>

        <div className="text-left space-y-2">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="overflow-hidden rounded-xl" style={{ border: "0.5px solid #e5e7eb" }}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-[14px] font-medium text-[#111827] hover:bg-[#f9fafb] transition-colors"
                >
                  {faq.q}
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#6b7280] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-[250ms]"
                  style={{ maxHeight: isOpen ? 300 : 0 }}
                >
                  <p className="px-5 pb-4 text-[13px] leading-[1.6] text-[#6b7280]">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
