import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, ArrowRight } from "lucide-react";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";
import { CountryPhoneSelect } from "@/components/ui/country-phone-select";
import { DIAL_COUNTRIES } from "@/lib/countriesDial";

const C = {
  deepEmerald: "#0B3D2E",
  darkTeal: "#0E5A47",
  accent: "#1ABC9C",
  mint: "#5FFFD7",
  cardBg: "#1f4038",
  textPrimary: "#FFFFFF",
};

// Routing is now driven by the partner_applications table.
// A country only has an active partner when at least one row exists with status = 'approved'
// AND that country in countries_covered. Otherwise the application enters the expansion queue.

const countries = [
  "Afghanistan","Albania","Algeria","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahrain","Bangladesh","Belarus","Belgium","Benin","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Bulgaria","Burkina Faso","Burundi",
  "Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic",
  "Democratic Republic of the Congo","Denmark","Djibouti","Dominican Republic",
  "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
  "Finland","France",
  "Gabon","Gambia","Georgia","Germany","Ghana","Greece","Guatemala","Guinea","Guinea-Bissau",
  "Haiti","Honduras","Hungary",
  "Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Ivory Coast",
  "Jamaica","Japan","Jordan",
  "Kazakhstan","Kenya","Kuwait","Kyrgyzstan",
  "Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Lithuania","Luxembourg",
  "Madagascar","Malawi","Malaysia","Mali","Mauritania","Mauritius","Mexico","Moldova","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
  "Namibia","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Macedonia","Norway",
  "Oman",
  "Pakistan","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal",
  "Qatar",
  "Romania","Russia","Rwanda",
  "Saudi Arabia","Senegal","Serbia","Sierra Leone","Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria",
  "Taiwan","Tajikistan","Tanzania","Thailand","Togo","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan",
  "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
  "Venezuela","Vietnam",
  "Yemen",
  "Zambia","Zimbabwe",
];

const buyerCountries = ["United Kingdom", "European Union"];
const invoiceSizes = ["Under £10k", "£10k–£50k", "£50k–£100k", "£100k–£500k", "Over £500k"];
const shipmentFreqs = ["1–2 per month", "3–5 per month", "6–10 per month", "10+ per month"];

interface FormData {
  full_name: string;
  company_name: string;
  rc_number: string;
  country: string;
  commodity: string;
  buyer_countries: string[];
  invoice_size: string;
  shipment_frequency: string;
  email: string;
  phone_iso: string;
  phone: string;
  deal_description: string;
}

export default function ExporterApply() {
  const [form, setForm] = useState<FormData>({
    full_name: "", company_name: "", rc_number: "", country: "", commodity: "",
    buyer_countries: [], invoice_size: "", shipment_frequency: "",
    email: "", phone_iso: "NG", phone: "", deal_description: "",
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (key: keyof FormData, value: string | string[]) => {
    setForm(p => ({ ...p, [key]: value }));
    setErrors(p => ({ ...p, [key]: false }));
  };

  const toggleBuyer = (c: string) => {
    const cur = form.buyer_countries;
    set("buyer_countries", cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]);
  };

  const validate = () => {
    const required: (keyof FormData)[] = ["full_name", "company_name", "rc_number", "country", "commodity", "invoice_size", "shipment_frequency", "email", "phone"];
    const errs: Record<string, boolean> = {};
    required.forEach(k => { if (!form[k] || (typeof form[k] === "string" && !(form[k] as string).trim())) errs[k] = true; });
    if (form.buyer_countries.length === 0) errs.buyer_countries = true;
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = true;
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = document.querySelector("[data-field-error]");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data: activePartners, error: lookupError } = await supabase
        .rpc("lookup_active_partners_for_country" as any, { p_country: form.country });

      if (lookupError) console.error("Partner lookup failed", lookupError);

      const matches = (activePartners as { name: string }[] | null) || [];
      const autoAssigned = matches.length === 1 ? matches[0].name : null;
      const status = matches.length >= 1 ? "routed" : "pending_expansion";

      const { error } = await supabase.from("exporter_applications" as any).insert({
        full_name: form.full_name.trim(),
        company_name: form.company_name.trim(),
        rc_number: form.rc_number.trim(),
        country: form.country,
        commodity: form.commodity.trim(),
        buyer_countries: form.buyer_countries,
        invoice_size: form.invoice_size,
        shipment_frequency: form.shipment_frequency,
        email: form.email.trim(),
        phone: `${DIAL_COUNTRIES.find(c => c.iso === form.phone_iso)?.dial ?? "+234"} ${form.phone.trim()}`,
        deal_description: form.deal_description.trim() || null,
        assigned_partner: autoAssigned,
        status,
      } as any);

      if (error) throw error;

      if (status === "routed") {
        setResultMessage(
          autoAssigned
            ? `Your application has been received and routed to ${autoAssigned}.`
            : `Your application has been received. Our admin team will assign one of our active partners in ${form.country}.`
        );
      } else {
        setResultMessage(
          `Thank you for your interest in Veloxis. We are currently expanding our network to ${form.country}. ` +
          `Your application has been saved and our team will be in touch as soon as we launch in your region. ` +
          `Trade without waiting. — The Veloxis Team`
        );
      }
      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Application submit failed", err);
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again or email support@veloxis.co.uk.";
      setSubmitError(msg);
      const banner = document.getElementById("apply-submit-error");
      banner?.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none transition-colors ${
      errors[field] ? "border-2 border-red-500" : "border border-white/10"
    }`;
  const inputBg = "rgba(255,255,255,0.04)";

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: C.deepEmerald }}>
        <nav className="flex items-center justify-between px-8 py-3" style={{ borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}>
          <Link to="/"><img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" /></Link>
        </nav>
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(26,188,156,0.15)" }}>
              <CheckCircle className="w-8 h-8 text-[#1ABC9C]" />
            </div>
            <h2 className="text-[28px] font-semibold text-white mb-4">Application submitted</h2>
            <p className="text-[15px] text-white/50 leading-relaxed mb-8">{resultMessage}</p>
            <Link to="/" className="inline-flex items-center gap-1.5 text-[#1ABC9C] text-[14px] font-medium hover:text-[#5FFFD7] transition-colors">
              Back to Veloxis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.deepEmerald }}>
      <Helmet>
        <title>Apply as Exporter | Veloxis</title>
        <meta name="description" content="Apply for trade finance with Veloxis. Get 80% of your invoice value within 24 hours." />
      </Helmet>

      <nav className="flex items-center justify-between px-8 py-3" style={{ borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}>
        <Link to="/"><img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" /></Link>
        <Link to="/login" className="text-[13px] font-medium text-white/50 hover:text-white transition-colors">Log in</Link>
      </nav>

      <div className="mx-auto max-w-[560px] px-8 py-12">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-2">Exporter registration</p>
          <h1 className="text-[32px] font-semibold text-white leading-[1.2] tracking-[-0.01em] mb-3">Get started with Veloxis</h1>
          <p className="text-[14px] text-white/45">Fill in your details and we will route your application to the right partner.</p>
        </div>

        <div className="rounded-2xl p-8 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(26,188,156,0.12)" }}>
          {/* Full name */}
          <div data-field-error={errors.full_name || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Full name *</label>
            <input className={inputClass("full_name")} style={{ background: inputBg }} placeholder="Your full name" value={form.full_name} onChange={e => set("full_name", e.target.value)} />
          </div>

          {/* Company name */}
          <div data-field-error={errors.company_name || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Company name *</label>
            <input className={inputClass("company_name")} style={{ background: inputBg }} placeholder="Your company name" value={form.company_name} onChange={e => set("company_name", e.target.value)} />
          </div>

          {/* RC Number */}
          <div data-field-error={errors.rc_number || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">RC Number *</label>
            <input className={inputClass("rc_number")} style={{ background: inputBg }} placeholder="e.g. RC123456" value={form.rc_number} onChange={e => set("rc_number", e.target.value)} />
            <p className="text-[11px] text-white/30 mt-1">Your company registration number (CAC / Companies House / equivalent).</p>
          </div>

          {/* Country */}
          <div data-field-error={errors.country || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Country of operation *</label>
            <select className={inputClass("country")} style={{ background: inputBg }} value={form.country} onChange={e => set("country", e.target.value)}>
              <option value="">Select country</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Commodity */}
          <div data-field-error={errors.commodity || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Commodity / goods exported *</label>
            <input className={inputClass("commodity")} style={{ background: inputBg }} placeholder="e.g. Solid minerals, textiles" value={form.commodity} onChange={e => set("commodity", e.target.value)} />
          </div>

          {/* Buyer countries */}
          <div data-field-error={errors.buyer_countries || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Buyer country *</label>
            <div className="flex flex-wrap gap-2">
              {buyerCountries.map(c => (
                <button key={c} type="button" onClick={() => toggleBuyer(c)}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors border ${
                    form.buyer_countries.includes(c)
                      ? "bg-[#1ABC9C]/20 border-[#1ABC9C]/40 text-[#5FFFD7]"
                      : "border-white/10 text-white/40 hover:border-white/20"
                  }`} style={{ background: form.buyer_countries.includes(c) ? undefined : inputBg }}>
                  {c}
                </button>
              ))}
            </div>
            {errors.buyer_countries && <p className="text-red-400 text-[12px] mt-1">Select at least one</p>}
          </div>

          {/* Invoice size */}
          <div data-field-error={errors.invoice_size || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Average invoice size *</label>
            <select className={inputClass("invoice_size")} style={{ background: inputBg }} value={form.invoice_size} onChange={e => set("invoice_size", e.target.value)}>
              <option value="">Select range</option>
              {invoiceSizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Shipment frequency */}
          <div data-field-error={errors.shipment_frequency || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Monthly shipment frequency *</label>
            <select className={inputClass("shipment_frequency")} style={{ background: inputBg }} value={form.shipment_frequency} onChange={e => set("shipment_frequency", e.target.value)}>
              <option value="">Select frequency</option>
              {shipmentFreqs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Email */}
          <div data-field-error={errors.email || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Email address *</label>
            <input type="email" className={inputClass("email")} style={{ background: inputBg }} placeholder="you@company.com" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>

          {/* Phone */}
          <div data-field-error={errors.phone || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Phone / WhatsApp *</label>
            <div className="flex gap-2">
              <CountryPhoneSelect value={form.phone_iso} onChange={iso => set("phone_iso", iso)} />
              <input className={`flex-1 ${inputClass("phone")}`} style={{ background: inputBg }} placeholder="Phone number" value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>
          </div>

          {/* Deal description */}
          <div>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Brief deal description (optional)</label>
            <textarea className={`${inputClass("deal_description")} min-h-[80px]`} style={{ background: inputBg }} placeholder="Tell us about your current or upcoming shipment" value={form.deal_description} onChange={e => set("deal_description", e.target.value)} />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 gradient-veloxis-btn text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all duration-200 disabled:opacity-50"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <>Submit application <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>

        <p className="text-center text-[12px] text-white/25 mt-6">
          Applying as a market partner? <Link to="/apply/partner" className="text-[#1ABC9C] hover:text-[#5FFFD7] transition-colors">Register here →</Link>
        </p>
      </div>
    </div>
  );
}
