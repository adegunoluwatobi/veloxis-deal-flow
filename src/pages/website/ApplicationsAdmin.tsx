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
type PartnerOrg = { id: string; name: string; country: string | null };

const exporterStatuses = ["routed", "in_progress", "funded", "rejected"];
const partnerStatuses = ["under_review", "approved", "rejected", "on_hold"];

interface ApplicationsAdminProps {
  embedded?: boolean;
}

export default function ApplicationsAdmin({ embedded = false }: ApplicationsAdminProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"routed" | "expansion" | "partners">("routed");
  const [exporterApps, setExporterApps] = useState<ExporterApp[]>([]);
  const [partnerApps, setPartnerApps] = useState<PartnerApp[]>([]);
  const [partnerOrgs, setPartnerOrgs] = useState<PartnerOrg[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [activateCountry, setActivateCountry] = useState<string | null>(null);
  const [activatePartnerName, setActivatePartnerName] = useState("");
  const [assignAppId, setAssignAppId] = useState<string | null>(null);
  const [assignSelectedPartner, setAssignSelectedPartner] = useState("");

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
    const [{ data: exp }, { data: part }, { data: orgs }] = await Promise.all([
      supabase.from("exporter_applications" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("partner_applications" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("partner_organisations").select("id, name, country").eq("is_active", true).order("name"),
    ]);
    setExporterApps((exp as any) || []);
    setPartnerApps((part as any) || []);
    setPartnerOrgs((orgs as any) || []);
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

  // Active partner organisations covering a given country (source of truth = partner_organisations)
  const activePartnersForCountry = (country: string) =>
    partnerOrgs.filter(p => (p.country ?? "").toLowerCase() === (country ?? "").toLowerCase());

  const activateCountryHandler = async (country: string) => {
    if (!activatePartnerName.trim()) return;
    await supabase.from("exporter_applications" as any)
      .update({ status: "routed", assigned_partner: activatePartnerName.trim(), expansion_activated: true } as any)
      .eq("country", country).eq("status", "pending_expansion");
    setActivateCountry(null);
    setActivatePartnerName("");
    loadData();
  };

  const assignSinglePartner = async () => {
    if (!assignAppId || !assignSelectedPartner.trim()) return;
    await supabase.from("exporter_applications" as any)
      .update({ status: "routed", assigned_partner: assignSelectedPartner.trim(), expansion_activated: true } as any)
      .eq("id", assignAppId);
    setAssignAppId(null);
    setAssignSelectedPartner("");
    loadData();
  };

  // Reassign a routed application to a different partner (or set initial partner if missing)
  const reassignRoutedPartner = async (appId: string, partnerName: string) => {
    await supabase.from("exporter_applications" as any)
      .update({ assigned_partner: partnerName || null } as any)
      .eq("id", appId);
    setExporterApps(p => p.map(a => a.id === appId ? { ...a, assigned_partner: partnerName || null } : a));
  };

  const routed = exporterApps.filter(a => a.status !== "pending_expansion" && a.status !== "contacted" && a.status !== "activated");
  const expansion = exporterApps.filter(a => ["pending_expansion", "contacted", "activated"].includes(a.status));

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
    if (embedded) {
      return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.deepEmerald }}>
        <Loader2 className="w-6 h-6 text-[#1ABC9C] animate-spin" />
      </div>
    );
  }

  // ============ Inner content (shared between embedded and standalone) ============
  const assignAppRecord = expansion.find(a => a.id === assignAppId) || null;
  const assignChoices = assignAppRecord ? activePartnersForCountry(assignAppRecord.country) : [];

  const Inner = (
    <>
      {/* Tabs */}
      <div className={`flex gap-1 mb-8 border-b ${embedded ? "border-border" : "border-white/10"}`}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-[13px] font-medium transition-colors border-b-2 ${
                active
                  ? (embedded ? "border-primary text-primary" : "border-[#1ABC9C] text-[#5FFFD7]")
                  : (embedded ? "border-transparent text-muted-foreground hover:text-foreground" : "border-transparent text-white/40 hover:text-white/60")
              }`}>
              {t.label} <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${embedded ? "bg-muted text-muted-foreground" : "bg-white/10"}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className={`w-6 h-6 animate-spin ${embedded ? "text-primary" : "text-[#1ABC9C]"}`} /></div>
      ) : (
        <>
          {/* Tab 1: Routed */}
          {tab === "routed" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className={`border-b ${embedded ? "border-border" : "border-white/10"}`}>
                    {["Name", "Company", "Country", "Commodity", "Invoice Size", "Assigned Partner", "Status", "Submitted", "Admin Notes"].map(h => (
                      <th key={h} className={`py-3 px-3 text-[11px] font-semibold uppercase tracking-wider ${embedded ? "text-muted-foreground" : "text-white/30"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {routed.map((a, i) => (
                    <tr key={a.id} className={`border-b ${embedded ? "border-border hover:bg-muted/40" : "border-white/5 hover:bg-[#1ABC9C]/5"} transition-colors ${i % 2 === 0 && !embedded ? "bg-white/[0.02]" : ""}`}>
                      <td className={`py-3 px-3 ${embedded ? "text-foreground" : "text-white"}`}>{a.full_name}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.company_name}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.country}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.commodity}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.invoice_size}</td>
                      <td className="py-3 px-3">
                        {(() => {
                          const choices = activePartnersForCountry(a.country);
                          if (choices.length === 0) {
                            return <span className={embedded ? "text-muted-foreground" : "text-white/40"}>{a.assigned_partner || "—"}</span>;
                          }
                          return (
                            <select
                              value={a.assigned_partner ?? ""}
                              onChange={e => reassignRoutedPartner(a.id, e.target.value)}
                              className={`rounded px-2 py-1 text-[12px] outline-none ${embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"}`}
                              style={embedded ? undefined : { background: inputBg }}
                            >
                              <option value="">— Unassigned —</option>
                              {choices.map(p => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                              ))}
                              {/* Preserve a partner name that no longer matches an active org */}
                              {a.assigned_partner && !choices.some(p => p.name === a.assigned_partner) && (
                                <option value={a.assigned_partner}>{a.assigned_partner} (legacy)</option>
                              )}
                            </select>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3">
                        <select value={a.status} onChange={e => updateExporterStatus(a.id, e.target.value)}
                          className={`rounded px-2 py-1 text-[12px] outline-none ${embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"}`}
                          style={embedded ? undefined : { background: inputBg }}>
                          {exporterStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/40"}`}>{fmtDate(a.created_at)}</td>
                      <td className="py-3 px-3">
                        <input
                          className={`w-full rounded px-2 py-1 text-[12px] outline-none ${embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"}`}
                          style={embedded ? undefined : { background: inputBg }}
                          placeholder="Add notes"
                          value={editingNotes[a.id] ?? a.admin_notes ?? ""}
                          onChange={e => setEditingNotes(p => ({ ...p, [a.id]: e.target.value }))}
                          onBlur={() => updateExporterNotes(a.id)}
                        />
                      </td>
                    </tr>
                  ))}
                  {routed.length === 0 && <tr><td colSpan={9} className={`py-10 text-center ${embedded ? "text-muted-foreground" : "text-white/30"}`}>No routed applications yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Expansion Queue */}
          {tab === "expansion" && (
            <div>
              {/* Country frequency — bulk activate */}
              {sortedCountries.length > 0 && (
                <div className={`mb-8 rounded-xl p-6 ${embedded ? "bg-card border border-border" : ""}`}
                  style={embedded ? undefined : { background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(26,188,156,0.12)" }}>
                  <h3 className={`text-[14px] font-semibold mb-4 ${embedded ? "text-foreground" : "text-white"}`}>Country Frequency</h3>
                  <div className="space-y-2">
                    {sortedCountries.map(([country, count]) => {
                      const partnersForCountry = activePartnersForCountry(country);
                      const hasPartners = partnersForCountry.length > 0;
                      return (
                        <div key={country} className="flex items-center justify-between">
                          <span className={`text-[13px] ${embedded ? "text-foreground" : "text-white/70"}`}>
                            {country}
                            {!hasPartners && <span className={`ml-2 text-[11px] ${embedded ? "text-muted-foreground" : "text-white/40"}`}>(no approved partner yet)</span>}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className={`text-[13px] font-medium ${embedded ? "text-primary" : "text-[#5FFFD7]"}`}>{count} application{count > 1 ? "s" : ""}</span>
                            <button
                              onClick={() => { setActivateCountry(country); setActivatePartnerName(partnersForCountry.length === 1 ? partnersForCountry[0].name : ""); }}
                              disabled={!hasPartners}
                              className={`text-[11px] px-3 py-1 rounded transition-colors ${
                                hasPartners
                                  ? (embedded ? "border border-primary text-primary hover:bg-primary/10" : "text-[#1ABC9C] border border-[#1ABC9C]/30 hover:bg-[#1ABC9C]/10")
                                  : (embedded ? "border border-border text-muted-foreground cursor-not-allowed" : "border border-white/10 text-white/30 cursor-not-allowed")
                              }`}>
                              Activate
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bulk Activate modal — choose from approved partners */}
              {activateCountry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                  <div className="rounded-2xl p-8 w-full max-w-[460px]" style={{ background: "#1a3a34", border: "0.5px solid rgba(26,188,156,0.2)" }}>
                    <h3 className="text-[18px] font-semibold text-white mb-2">Activate {activateCountry}</h3>
                    <p className="text-[13px] text-white/45 mb-4">
                      Select an approved partner to receive all pending applications from {activateCountry}.
                    </p>
                    {activePartnersForCountry(activateCountry).length === 0 ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-4 text-[12px] text-amber-300">
                        No approved partners cover {activateCountry} yet. Approve a partner application first under the Partner Applications tab.
                      </div>
                    ) : (
                      <select
                        className="w-full rounded-lg px-4 py-3 text-[14px] text-white border border-white/10 outline-none mb-4"
                        style={{ background: inputBg }}
                        value={activatePartnerName}
                        onChange={e => setActivatePartnerName(e.target.value)}
                      >
                        <option value="">Select partner...</option>
                        {activePartnersForCountry(activateCountry).map(p => (
                          <option key={p.id} value={p.name}>
                            {p.name} — {activateCountry}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => { setActivateCountry(null); setActivatePartnerName(""); }} className="flex-1 py-2.5 rounded-lg text-[13px] text-white/50 border border-white/10">Cancel</button>
                      <button
                        onClick={() => activateCountryHandler(activateCountry)}
                        disabled={!activatePartnerName.trim()}
                        className="flex-1 py-2.5 rounded-lg text-[13px] gradient-veloxis-btn text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                        Activate
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-row Assign-to-Partner modal */}
              {assignAppRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                  <div className="rounded-2xl p-8 w-full max-w-[460px]" style={{ background: "#1a3a34", border: "0.5px solid rgba(26,188,156,0.2)" }}>
                    <h3 className="text-[18px] font-semibold text-white mb-2">Assign to Partner</h3>
                    <p className="text-[13px] text-white/45 mb-4">
                      {assignAppRecord.full_name} — {assignAppRecord.company_name} ({assignAppRecord.country})
                    </p>
                    {assignChoices.length === 0 ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-4 text-[12px] text-amber-300">
                        No approved partners cover {assignAppRecord.country} yet.
                      </div>
                    ) : (
                      <select
                        className="w-full rounded-lg px-4 py-3 text-[14px] text-white border border-white/10 outline-none mb-4"
                        style={{ background: inputBg }}
                        value={assignSelectedPartner}
                        onChange={e => setAssignSelectedPartner(e.target.value)}
                      >
                        <option value="">Select partner...</option>
                        {assignChoices.map(p => (
                          <option key={p.id} value={p.name}>
                            {p.name} — {assignAppRecord.country}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => { setAssignAppId(null); setAssignSelectedPartner(""); }} className="flex-1 py-2.5 rounded-lg text-[13px] text-white/50 border border-white/10">Cancel</button>
                      <button
                        onClick={assignSinglePartner}
                        disabled={!assignSelectedPartner.trim()}
                        className="flex-1 py-2.5 rounded-lg text-[13px] gradient-veloxis-btn text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                        Assign
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className={`border-b ${embedded ? "border-border" : "border-white/10"}`}>
                      {["Name", "Company", "Country", "Commodity", "Invoice Size", "Email", "Phone", "Submitted", "Status", "Actions"].map(h => (
                        <th key={h} className={`py-3 px-3 text-[11px] font-semibold uppercase tracking-wider ${embedded ? "text-muted-foreground" : "text-white/30"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expansion.map((a, i) => {
                      const choices = activePartnersForCountry(a.country);
                      return (
                        <tr key={a.id} className={`border-b ${embedded ? "border-border hover:bg-muted/40" : "border-white/5 hover:bg-[#1ABC9C]/5"} transition-colors ${i % 2 === 0 && !embedded ? "bg-white/[0.02]" : ""}`}>
                          <td className={`py-3 px-3 ${embedded ? "text-foreground" : "text-white"}`}>{a.full_name}</td>
                          <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.company_name}</td>
                          <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.country}</td>
                          <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.commodity}</td>
                          <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.invoice_size}</td>
                          <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.email}</td>
                          <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.phone}</td>
                          <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/40"}`}>{fmtDate(a.created_at)}</td>
                          <td className="py-3 px-3">
                            <span className={`text-[11px] px-2 py-0.5 rounded ${
                              a.status === "activated" ? (embedded ? "bg-primary/15 text-primary" : "bg-[#1ABC9C]/15 text-[#5FFFD7]") :
                              a.status === "contacted" ? "bg-amber-500/15 text-amber-400" :
                              (embedded ? "bg-muted text-muted-foreground" : "bg-white/10 text-white/40")
                            }`}>{a.status}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex gap-1 flex-wrap">
                              {a.status === "pending_expansion" && (
                                <>
                                  <button onClick={() => markContacted(a.id)}
                                    className={`text-[11px] px-2 py-0.5 rounded ${embedded ? "border border-border text-foreground hover:bg-muted" : "text-[#1ABC9C] border border-[#1ABC9C]/30 hover:bg-[#1ABC9C]/10"}`}>
                                    Contacted
                                  </button>
                                  {choices.length > 0 && (
                                    <button onClick={() => { setAssignAppId(a.id); setAssignSelectedPartner(choices.length === 1 ? choices[0].name : ""); }}
                                      className={`text-[11px] px-2 py-0.5 rounded ${embedded ? "border border-primary text-primary hover:bg-primary/10" : "text-[#5FFFD7] border border-[#1ABC9C]/40 hover:bg-[#1ABC9C]/10"}`}>
                                      Assign ({choices.length})
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {expansion.length === 0 && <tr><td colSpan={10} className={`py-10 text-center ${embedded ? "text-muted-foreground" : "text-white/30"}`}>No expansion queue applications</td></tr>}
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
                  <tr className={`border-b ${embedded ? "border-border" : "border-white/10"}`}>
                    {["Name", "Company", "Countries", "Partner Type", "Network Size", "Email", "Phone", "Status", "Submitted", "Admin Notes"].map(h => (
                      <th key={h} className={`py-3 px-3 text-[11px] font-semibold uppercase tracking-wider ${embedded ? "text-muted-foreground" : "text-white/30"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partnerApps.map((a, i) => (
                    <tr key={a.id} className={`border-b ${embedded ? "border-border hover:bg-muted/40" : "border-white/5 hover:bg-[#1ABC9C]/5"} transition-colors ${i % 2 === 0 && !embedded ? "bg-white/[0.02]" : ""}`}>
                      <td className={`py-3 px-3 ${embedded ? "text-foreground" : "text-white"}`}>{a.full_name}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.company_name}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{(a.countries_covered || []).join(", ")}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.partner_type}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.network_size}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.email}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.phone}</td>
                      <td className="py-3 px-3">
                        <select value={a.status} onChange={e => updatePartnerStatus(a.id, e.target.value)}
                          className={`rounded px-2 py-1 text-[12px] outline-none ${embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"}`}
                          style={embedded ? undefined : { background: inputBg }}>
                          {partnerStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/40"}`}>{fmtDate(a.created_at)}</td>
                      <td className="py-3 px-3">
                        <input
                          className={`w-full rounded px-2 py-1 text-[12px] outline-none ${embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"}`}
                          style={embedded ? undefined : { background: inputBg }}
                          placeholder="Add notes"
                          value={editingNotes[a.id] ?? a.admin_notes ?? ""}
                          onChange={e => setEditingNotes(p => ({ ...p, [a.id]: e.target.value }))}
                          onBlur={() => updatePartnerNotes(a.id)}
                        />
                      </td>
                    </tr>
                  ))}
                  {partnerApps.length === 0 && <tr><td colSpan={10} className={`py-10 text-center ${embedded ? "text-muted-foreground" : "text-white/30"}`}>No partner applications yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Registration Pipeline</h1>
          <p className="text-muted-foreground mt-1">Routed leads, expansion queue, and partner applications</p>
        </div>
        {Inner}
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
        {Inner}
      </div>
    </div>
  );
}
