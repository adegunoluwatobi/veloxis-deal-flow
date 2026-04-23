import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, ArrowRight } from "lucide-react";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";
import { CountryPhoneSelect } from "@/components/ui/country-phone-select";
import { DIAL_COUNTRIES } from "@/lib/countriesDial";

const C = { deepEmerald: "#0B3D2E" };

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

const partnerTypes = ["Trade Agent", "Compliance & KYC Partner", "Business Introducer", "Trade Facilitator", "Other"];
const sectorOptions = ["Agriculture", "Minerals & Metals", "FMCG", "Processed Foods", "Other"];
const networkSizes = ["1–10", "11–50", "51–200", "200+"];

interface FormData {
  full_name: string; company_name: string; countries_covered: string[];
  partner_type: string; sectors: string[]; network_size: string;
  email: string; phone_iso: string; phone: string; description: string; website: string;
  company_registration_number: string;
  country_of_incorporation: string;
  registered_address_line1: string;
  registered_city: string;
  registered_country: string;
}

export default function PartnerApply() {
  const [form, setForm] = useState<FormData>({
    full_name: "", company_name: "", countries_covered: [], partner_type: "",
    sectors: [], network_size: "", email: "", phone_iso: "NG", phone: "",
    description: "", website: "",
    company_registration_number: "", country_of_incorporation: "",
    registered_address_line1: "", registered_city: "", registered_country: "",
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof FormData, value: string | string[]) => {
    setForm(p => ({ ...p, [key]: value }));
    setErrors(p => ({ ...p, [key]: false }));
  };

  const toggleArr = (key: "countries_covered" | "sectors", val: string) => {
    const cur = form[key] as string[];
    set(key, cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]);
  };

  const validate = () => {
    const errs: Record<string, boolean> = {};
    ["full_name","company_name","partner_type","network_size","email","phone"].forEach(k => {
      if (!(form[k as keyof FormData] as string)?.trim()) errs[k] = true;
    });
    if (form.countries_covered.length === 0) errs.countries_covered = true;
    if (form.sectors.length === 0) errs.sectors = true;
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = true;
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("partner_applications" as any).insert({
        full_name: form.full_name.trim(),
        company_name: form.company_name.trim(),
        countries_covered: form.countries_covered,
        partner_type: form.partner_type,
        sectors: form.sectors,
        network_size: form.network_size,
        email: form.email.trim(),
        phone: `${DIAL_COUNTRIES.find(c => c.iso === form.phone_iso)?.dial ?? "+234"} ${form.phone.trim()}`,
        description: form.description.trim() || null,
        website: form.website.trim() || null,
        status: "under_review",
      } as any);
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error(err);
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
            <p className="text-[15px] text-white/50 leading-relaxed mb-8">Thank you. Veloxis will review your partner application and contact you when your market coverage matches our active corridors.</p>
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
        <title>Partner Registration | Veloxis</title>
        <meta name="description" content="Register as a Veloxis market partner. Bring your exporters, we handle the finance." />
      </Helmet>

      <nav className="flex items-center justify-between px-8 py-3" style={{ borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}>
        <Link to="/"><img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" /></Link>
        <Link to="/login" className="text-[13px] font-medium text-white/50 hover:text-white transition-colors">Log in</Link>
      </nav>

      <div className="mx-auto max-w-[560px] px-8 py-12">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1ABC9C] mb-2">Partner registration</p>
          <h1 className="text-[32px] font-semibold text-white leading-[1.2] tracking-[-0.01em] mb-3">Join the Veloxis network</h1>
          <p className="text-[14px] text-white/45">Bring your exporters. We handle the finance.</p>
        </div>

        <div className="rounded-2xl p-8 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(26,188,156,0.12)" }}>
          <div data-field-error={errors.full_name || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Full name *</label>
            <input className={inputClass("full_name")} style={{ background: inputBg }} placeholder="Your full name" value={form.full_name} onChange={e => set("full_name", e.target.value)} />
          </div>

          <div data-field-error={errors.company_name || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Company / organisation name *</label>
            <input className={inputClass("company_name")} style={{ background: inputBg }} placeholder="Your company name" value={form.company_name} onChange={e => set("company_name", e.target.value)} />
          </div>

          <div data-field-error={errors.countries_covered || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Country or region covered *</label>
            <select className={inputClass("countries_covered")} style={{ background: inputBg }}
              onChange={e => { if (e.target.value && !form.countries_covered.includes(e.target.value)) toggleArr("countries_covered", e.target.value); e.target.value = ""; }}>
              <option value="">Add a country</option>
              {countries.filter(c => !form.countries_covered.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {form.countries_covered.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.countries_covered.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] bg-[#1ABC9C]/15 text-[#5FFFD7] border border-[#1ABC9C]/25">
                    {c}
                    <button onClick={() => toggleArr("countries_covered", c)} className="text-white/40 hover:text-white ml-1">×</button>
                  </span>
                ))}
              </div>
            )}
            {errors.countries_covered && <p className="text-red-400 text-[12px] mt-1">Select at least one</p>}
          </div>

          <div data-field-error={errors.partner_type || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Partner type *</label>
            <select className={inputClass("partner_type")} style={{ background: inputBg }} value={form.partner_type} onChange={e => set("partner_type", e.target.value)}>
              <option value="">Select type</option>
              {partnerTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div data-field-error={errors.sectors || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Sectors covered *</label>
            <div className="flex flex-wrap gap-2">
              {sectorOptions.map(s => (
                <button key={s} type="button" onClick={() => toggleArr("sectors", s)}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors border ${
                    form.sectors.includes(s) ? "bg-[#1ABC9C]/20 border-[#1ABC9C]/40 text-[#5FFFD7]" : "border-white/10 text-white/40 hover:border-white/20"
                  }`} style={{ background: form.sectors.includes(s) ? undefined : inputBg }}>
                  {s}
                </button>
              ))}
            </div>
            {errors.sectors && <p className="text-red-400 text-[12px] mt-1">Select at least one</p>}
          </div>

          <div data-field-error={errors.network_size || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Estimated exporter network size *</label>
            <select className={inputClass("network_size")} style={{ background: inputBg }} value={form.network_size} onChange={e => set("network_size", e.target.value)}>
              <option value="">Select size</option>
              {networkSizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div data-field-error={errors.email || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Email address *</label>
            <input type="email" className={inputClass("email")} style={{ background: inputBg }} placeholder="you@company.com" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>

          <div data-field-error={errors.phone || undefined}>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Phone / WhatsApp *</label>
            <div className="flex gap-2">
              <CountryPhoneSelect value={form.phone_iso} onChange={iso => set("phone_iso", iso)} />
              <input className={`flex-1 ${inputClass("phone")}`} style={{ background: inputBg }} placeholder="Phone number" value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Brief description of your network and capability *</label>
            <textarea className={`${inputClass("description")} min-h-[80px]`} style={{ background: inputBg }} placeholder="Describe your network, capabilities, and how you work with exporters" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-white/50 mb-1.5">Company profile link or website (optional)</label>
            <input className={inputClass("website")} style={{ background: inputBg }} placeholder="https://yourcompany.com" value={form.website} onChange={e => set("website", e.target.value)} />
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full flex items-center justify-center gap-2 gradient-veloxis-btn text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all duration-200 disabled:opacity-50">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <>Submit application <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
