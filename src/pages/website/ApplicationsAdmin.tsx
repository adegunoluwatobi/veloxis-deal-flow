import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";

const C = { deepEmerald: "#0B3D2E", accent: "#1ABC9C" };
const inputBg = "rgba(255,255,255,0.04)";

type ExporterApp = {
  id: string; full_name: string; company_name: string; country: string; commodity: string;
  buyer_countries: string[]; invoice_size: string; shipment_frequency: string; email: string;
  phone: string; deal_description: string | null; assigned_partner: string | null;
  status: string; expansion_activated: boolean; admin_notes: string | null; created_at: string;
};
type PartnerApp = {
  id: string; full_name: string; company_name: string; countries_covered: string[];
  partner_type: string; sectors: string[]; network_size: string; email: string; phone: string;
  description: string | null; website: string | null; status: string; admin_notes: string | null; created_at: string;
};

const exporterStatuses = ["routed", "in_progress", "funded", "rejected"];
const partnerStatuses = ["under_review", "approved", "rejected", "on_hold"];

export default function ApplicationsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"routed" | "expansion" | "partners">("routed");
  const [exporterApps, setExporterApps] = useState<ExporterApp[]>([]);
  const [partnerApps, setPartnerApps] = useState<PartnerApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [activateCountry, setActivateCountry] = useState<string | null>(null);
  const [activatePartnerName, setActivatePartnerName] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    loadData();
  }, [authLoading, user, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const loadData = async () => {
    setLoading(true);
    const [{ data: exp }, { data: part }] = await Promise.all([
      supabase.from("exporter_applications" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("partner_applications" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setExporterApps((exp as any) || []);
    setPartnerApps((part as any) || []);
    setLoading(false);
  };

  const updateExporterStatus = async (id: string, status: string) => {
    await supabase.from("exporter_applications" as any).update({ status } as any).eq("id", id);
    setExporterApps(p => p.map(a => a.id === id ? { ...a, status } : a));
  };

  const updateExporterNotes = async (id: string) => {
    const notes = editingNotes[id] ?? "";
    await supabase.from("exporter_applications" as any).update({ admin_notes: notes } as any).eq("id", id);
    setExporterApps(p => p.map(a => a.id === id ? { ...a, admin_notes: notes } : a));
  };

  const updatePartnerStatus = async (id: string, status: string) => {
    await supabase.from("partner_applications" as any).update({ status } as any).eq("id", id);
    setPartnerApps(p => p.map(a => a.id === id ? { ...a, status } : a));
  };

  const updatePartnerNotes = async (id: string) => {
    const notes = editingNotes[id] ?? "";
    await supabase.from("partner_applications" as any).update({ admin_notes: notes } as any).eq("id", id);
    setPartnerApps(p => p.map(a => a.id === id ? { ...a, admin_notes: notes } : a));
  };

  const markContacted = async (id: string) => {
    await supabase.from("exporter_applications" as any).update({ status: "contacted" } as any).eq("id", id);
    setExporterApps(p => p.map(a => a.id === id ? { ...a, status: "contacted" } : a));
  };

  const activateCountryHandler = async (country: string) => {
    if (!activatePartnerName.trim()) return;
    // Update all pending_expansion apps from this country
    await supabase.from("exporter_applications" as any)
      .update({ status: "activated", assigned_partner: activatePartnerName.trim(), expansion_activated: true } as any)
      .eq("country", country).eq("status", "pending_expansion");
    setActivateCountry(null);
    setActivatePartnerName("");
    loadData();
  };

  const routed = exporterApps.filter(a => a.status !== "pending_expansion" && a.status !== "contacted" && a.status !== "activated");
  const expansion = exporterApps.filter(a => ["pending_expansion", "contacted", "activated"].includes(a.status));

  // Country frequency counter
  const countryFreq: Record<string, number> = {};
  expansion.filter(a => a.status === "pending_expansion").forEach(a => { countryFreq[a.country] = (countryFreq[a.country] || 0) + 1; });
  const sortedCountries = Object.entries(countryFreq).sort((a, b) => b[1] - a[1]);

  const tabs = [
    { key: "routed" as const, label: "Routed Applications", count: routed.length },
    { key: "expansion" as const, label: "Expansion Queue", count: expansion.length },
    { key: "partners" as const, label: "Partner Applications", count: partnerApps.length },
  ];

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.deepEmerald }}>
        <Loader2 className="w-6 h-6 text-[#1ABC9C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.deepEmerald }}>
      <nav className="flex items-center justify-between px-8 py-3" style={{ borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}>
        <Link to="/"><img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" /></Link>
        <div className="flex items-center gap-4">
          <span className="text-[13px] text-white/40">Applications Admin</span>
          <button onClick={handleSignOut} className="text-[12px] text-[#1ABC9C] border border-[#1ABC9C]/30 px-3 py-1 rounded hover:bg-[#1ABC9C]/10 transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-[1200px] px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-white/10">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-[13px] font-medium transition-colors border-b-2 ${
                tab === t.key ? "border-[#1ABC9C] text-[#5FFFD7]" : "border-transparent text-white/40 hover:text-white/60"
              }`}>
              {t.label} <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-white/10">{t.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-[#1ABC9C] animate-spin" /></div>
        ) : (
          <>
            {/* Tab 1: Routed */}
            {tab === "routed" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      {["Name", "Company", "Country", "Commodity", "Invoice Size", "Assigned Partner", "Status", "Submitted", "Admin Notes"].map(h => (
                        <th key={h} className="py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {routed.map((a, i) => (
                      <tr key={a.id} className={`border-b border-white/5 hover:bg-[#1ABC9C]/5 transition-colors ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                        <td className="py-3 px-3 text-white">{a.full_name}</td>
                        <td className="py-3 px-3 text-white/60">{a.company_name}</td>
                        <td className="py-3 px-3 text-white/60">{a.country}</td>
                        <td className="py-3 px-3 text-white/60">{a.commodity}</td>
                        <td className="py-3 px-3 text-white/60">{a.invoice_size}</td>
                        <td className="py-3 px-3 text-[#1ABC9C]">{a.assigned_partner || "—"}</td>
                        <td className="py-3 px-3">
                          <select value={a.status} onChange={e => updateExporterStatus(a.id, e.target.value)}
                            className="rounded px-2 py-1 text-[12px] text-white border border-white/10 outline-none" style={{ background: inputBg }}>
                            {exporterStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-white/40">{fmtDate(a.created_at)}</td>
                        <td className="py-3 px-3">
                          <input
                            className="w-full rounded px-2 py-1 text-[12px] text-white border border-white/10 outline-none" style={{ background: inputBg }}
                            placeholder="Add notes"
                            value={editingNotes[a.id] ?? a.admin_notes ?? ""}
                            onChange={e => setEditingNotes(p => ({ ...p, [a.id]: e.target.value }))}
                            onBlur={() => updateExporterNotes(a.id)}
                          />
                        </td>
                      </tr>
                    ))}
                    {routed.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-white/30">No routed applications yet</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Expansion Queue */}
            {tab === "expansion" && (
              <div>
                {/* Country frequency */}
                {sortedCountries.length > 0 && (
                  <div className="mb-8 rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(26,188,156,0.12)" }}>
                    <h3 className="text-[14px] font-semibold text-white mb-4">Country Frequency</h3>
                    <div className="space-y-2">
                      {sortedCountries.map(([country, count]) => (
                        <div key={country} className="flex items-center justify-between">
                          <span className="text-[13px] text-white/70">{country}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[13px] text-[#5FFFD7] font-medium">{count} application{count > 1 ? "s" : ""}</span>
                            <button onClick={() => { setActivateCountry(country); setActivatePartnerName(""); }}
                              className="text-[11px] text-[#1ABC9C] border border-[#1ABC9C]/30 px-3 py-1 rounded hover:bg-[#1ABC9C]/10 transition-colors">
                              Activate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activate modal */}
                {activateCountry && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="rounded-2xl p-8 w-full max-w-[400px]" style={{ background: "#1a3a34", border: "0.5px solid rgba(26,188,156,0.2)" }}>
                      <h3 className="text-[18px] font-semibold text-white mb-2">Activate {activateCountry}</h3>
                      <p className="text-[13px] text-white/45 mb-4">Enter the partner desk name for this country. All pending applications will be updated.</p>
                      <input
                        className="w-full rounded-lg px-4 py-3 text-[14px] text-white border border-white/10 outline-none mb-4" style={{ background: inputBg }}
                        placeholder="Partner desk name"
                        value={activatePartnerName}
                        onChange={e => setActivatePartnerName(e.target.value)}
                      />
                      <div className="flex gap-3">
                        <button onClick={() => setActivateCountry(null)} className="flex-1 py-2.5 rounded-lg text-[13px] text-white/50 border border-white/10">Cancel</button>
                        <button onClick={() => activateCountryHandler(activateCountry)} className="flex-1 py-2.5 rounded-lg text-[13px] gradient-veloxis-btn text-white font-medium">Activate</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-white/10">
                        {["Name", "Company", "Country", "Commodity", "Invoice Size", "Email", "Phone", "Submitted", "Status", "Admin Notes"].map(h => (
                          <th key={h} className="py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expansion.map((a, i) => (
                        <tr key={a.id} className={`border-b border-white/5 hover:bg-[#1ABC9C]/5 transition-colors ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                          <td className="py-3 px-3 text-white">{a.full_name}</td>
                          <td className="py-3 px-3 text-white/60">{a.company_name}</td>
                          <td className="py-3 px-3 text-white/60">{a.country}</td>
                          <td className="py-3 px-3 text-white/60">{a.commodity}</td>
                          <td className="py-3 px-3 text-white/60">{a.invoice_size}</td>
                          <td className="py-3 px-3 text-white/60">{a.email}</td>
                          <td className="py-3 px-3 text-white/60">{a.phone}</td>
                          <td className="py-3 px-3 text-white/40">{fmtDate(a.created_at)}</td>
                          <td className="py-3 px-3">
                            <div className="flex gap-1">
                              {a.status === "pending_expansion" && (
                                <button onClick={() => markContacted(a.id)} className="text-[11px] text-[#1ABC9C] border border-[#1ABC9C]/30 px-2 py-0.5 rounded hover:bg-[#1ABC9C]/10">Contacted</button>
                              )}
                              <span className={`text-[11px] px-2 py-0.5 rounded ${
                                a.status === "activated" ? "bg-[#1ABC9C]/15 text-[#5FFFD7]" :
                                a.status === "contacted" ? "bg-amber-500/15 text-amber-400" :
                                "bg-white/10 text-white/40"
                              }`}>{a.status}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <input
                              className="w-full rounded px-2 py-1 text-[12px] text-white border border-white/10 outline-none" style={{ background: inputBg }}
                              placeholder="Add notes"
                              value={editingNotes[a.id] ?? a.admin_notes ?? ""}
                              onChange={e => setEditingNotes(p => ({ ...p, [a.id]: e.target.value }))}
                              onBlur={() => updateExporterNotes(a.id)}
                            />
                          </td>
                        </tr>
                      ))}
                      {expansion.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-white/30">No expansion queue applications</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 3: Partner Applications */}
            {tab === "partners" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      {["Name", "Company", "Countries", "Partner Type", "Network Size", "Email", "Phone", "Status", "Submitted", "Admin Notes"].map(h => (
                        <th key={h} className="py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partnerApps.map((a, i) => (
                      <tr key={a.id} className={`border-b border-white/5 hover:bg-[#1ABC9C]/5 transition-colors ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                        <td className="py-3 px-3 text-white">{a.full_name}</td>
                        <td className="py-3 px-3 text-white/60">{a.company_name}</td>
                        <td className="py-3 px-3 text-white/60">{(a.countries_covered || []).join(", ")}</td>
                        <td className="py-3 px-3 text-white/60">{a.partner_type}</td>
                        <td className="py-3 px-3 text-white/60">{a.network_size}</td>
                        <td className="py-3 px-3 text-white/60">{a.email}</td>
                        <td className="py-3 px-3 text-white/60">{a.phone}</td>
                        <td className="py-3 px-3">
                          <select value={a.status} onChange={e => updatePartnerStatus(a.id, e.target.value)}
                            className="rounded px-2 py-1 text-[12px] text-white border border-white/10 outline-none" style={{ background: inputBg }}>
                            {partnerStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-white/40">{fmtDate(a.created_at)}</td>
                        <td className="py-3 px-3">
                          <input
                            className="w-full rounded px-2 py-1 text-[12px] text-white border border-white/10 outline-none" style={{ background: inputBg }}
                            placeholder="Add notes"
                            value={editingNotes[a.id] ?? a.admin_notes ?? ""}
                            onChange={e => setEditingNotes(p => ({ ...p, [a.id]: e.target.value }))}
                            onBlur={() => updatePartnerNotes(a.id)}
                          />
                        </td>
                      </tr>
                    ))}
                    {partnerApps.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-white/30">No partner applications yet</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
