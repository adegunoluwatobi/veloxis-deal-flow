import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";

const C = { deepEmerald: "#0B3D2E", accent: "#1ABC9C" };
const inputBg = "rgba(255,255,255,0.04)";

type ExporterApp = {
  id: string; full_name: string; company_name: string; country: string; commodity: string;
  buyer_countries: string[]; invoice_size: string; shipment_frequency: string; email: string;
  phone: string; deal_description: string | null; assigned_partner: string | null;
  assigned_partner_id: string | null; exporter_id: string | null;
  status: string; expansion_activated: boolean; admin_notes: string | null; created_at: string;
};
type PartnerApp = {
  id: string; full_name: string; company_name: string; countries_covered: string[];
  partner_type: string; sectors: string[]; network_size: string; email: string; phone: string;
  description: string | null; website: string | null; status: string; admin_notes: string | null; created_at: string;
};
type PartnerOrg = { id: string; name: string; country: string | null };

// Registration Pipeline statuses — only these three are valid here.
// "approved/rejected/closed" belong to the Deals pipeline, not registration.
const PIPELINE_STATUSES = ["routed", "assigned", "expansion"] as const;
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingAssign, setPendingAssign] = useState<{ app: ExporterApp; partner: PartnerOrg } | null>(null);

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
    // Normalise legacy statuses to the new three-state model
    const normalised = ((exp as any[]) ?? []).map(a => {
      let s = a.status as string;
      if (s === "pending_expansion" || s === "contacted" || s === "activated") s = "expansion";
      if (!PIPELINE_STATUSES.includes(s as typeof PIPELINE_STATUSES[number])) {
        s = a.assigned_partner_id ? "assigned" : "routed";
      }
      return { ...a, status: s } as ExporterApp;
    });
    setExporterApps(normalised);
    setPartnerApps((part as any) || []);
    setPartnerOrgs((orgs as any) || []);
    setLoading(false);
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

  // Manually mark an application as Expansion (no partner exists in country yet)
  const moveToExpansion = async (id: string) => {
    setBusyId(id);
    await supabase.from("exporter_applications" as any)
      .update({ status: "expansion", assigned_partner: null, assigned_partner_id: null, exporter_id: null } as any)
      .eq("id", id);
    setExporterApps(p => p.map(a => a.id === id
      ? { ...a, status: "expansion", assigned_partner: null, assigned_partner_id: null, exporter_id: null }
      : a));
    setBusyId(null);
  };

  // Move back to Routed (clear partner assignment)
  const moveToRouted = async (id: string) => {
    setBusyId(id);
    await supabase.from("exporter_applications" as any)
      .update({ status: "routed", assigned_partner: null, assigned_partner_id: null, exporter_id: null } as any)
      .eq("id", id);
    setExporterApps(p => p.map(a => a.id === id
      ? { ...a, status: "routed", assigned_partner: null, assigned_partner_id: null, exporter_id: null }
      : a));
    setBusyId(null);
  };

  // Active partner organisations covering a given country
  const activePartnersForCountry = (country: string) =>
    partnerOrgs.filter(p => (p.country ?? "").toLowerCase() === (country ?? "").toLowerCase());

  // Step 1: dropdown change → open confirmation modal (no DB write yet)
  const requestAssignPartner = (app: ExporterApp, partnerOrgId: string) => {
    if (!partnerOrgId) {
      // Cleared selection → revert to routed (no confirmation needed)
      moveToRouted(app.id);
      return;
    }
    const partner = partnerOrgs.find(p => p.id === partnerOrgId);
    if (!partner) return;
    setPendingAssign({ app, partner });
  };

  // Step 2: user clicks "Confirm Assignment" in modal → perform the write
  const confirmAssignPartner = async () => {
    if (!pendingAssign) return;
    const { app, partner } = pendingAssign;
    setPendingAssign(null);
    setBusyId(app.id);
    try {
      // 1) Find the default originator user for this partner organisation
      const { data: originatorId, error: rpcErr } = await supabase.rpc(
        "default_originator_for_partner_org" as any,
        { p_org_id: partner.id } as any,
      );
      if (rpcErr) throw rpcErr;
      if (!originatorId) {
        toast.error(`${partner.name} has no partner_admin user configured. Add a partner admin before assigning exporters to this organisation.`);
        setBusyId(null);
        return;
      }

      // 2) Create or reuse the exporter profile
      let exporterId = app.exporter_id;
      if (!exporterId) {
        const { data: newExp, error: insErr } = await supabase.from("exporters").insert({
          company_name: app.company_name,
          rc_number: "PENDING",
          entity_type: "limited_company" as any,
          director_name: app.full_name,
          contact_email: app.email,
          country: app.country,
          originator_id: originatorId as string,
          is_active: true,
        } as any).select("id").maybeSingle();
        if (insErr) throw insErr;
        exporterId = newExp?.id ?? null;
      } else {
        // Re-activate if previously suspended
        await supabase.from("exporters").update({ is_active: true } as any).eq("id", exporterId);
      }

      // 3) Update the application
      await supabase.from("exporter_applications" as any).update({
        status: "assigned",
        assigned_partner: partner.name,
        assigned_partner_id: partner.id,
        exporter_id: exporterId,
        expansion_activated: true,
      } as any).eq("id", app.id);

      // 4) Remove from local list (it's no longer in Routed/Expansion)
      setExporterApps(p => p.filter(a => a.id !== app.id));
      toast.success(`✓ ${app.company_name} successfully assigned to ${partner.name}`);
    } catch (e: any) {
      toast.error(`Assignment failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setBusyId(null);
    }
  };

  const routed = exporterApps.filter(a => a.status === "routed");
  const expansion = exporterApps.filter(a => a.status === "expansion");

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

  // Render the partner selector + status select for one application row
  const renderRowControls = (a: ExporterApp) => {
    const choices = activePartnersForCountry(a.country);
    const disabled = busyId === a.id;
    return (
      <>
        <td className="py-3 px-3">
          {choices.length === 0 ? (
            <span className={embedded ? "text-muted-foreground text-[12px]" : "text-white/40 text-[12px]"}>
              No partner in {a.country}
            </span>
          ) : (
            <select
              disabled={disabled}
              value={a.assigned_partner_id ?? ""}
              onChange={e => assignPartner(a, e.target.value)}
              className={`rounded px-2 py-1 text-[12px] outline-none disabled:opacity-50 ${embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"}`}
              style={embedded ? undefined : { background: inputBg }}
            >
              <option value="">— Unassigned —</option>
              {choices.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </td>
        <td className="py-3 px-3">
          <select
            disabled={disabled}
            value={a.status}
            onChange={e => {
              const next = e.target.value;
              if (next === a.status) return;
              if (next === "expansion") moveToExpansion(a.id);
              else if (next === "routed") moveToRouted(a.id);
              // "assigned" cannot be selected manually — must come from partner dropdown
            }}
            className={`rounded px-2 py-1 text-[12px] outline-none disabled:opacity-50 ${embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"}`}
            style={embedded ? undefined : { background: inputBg }}
          >
            <option value="routed">Routed</option>
            <option value="expansion">Expansion</option>
            <option value="assigned" disabled>Assigned (auto)</option>
          </select>
        </td>
      </>
    );
  };

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
                      {renderRowControls(a)}
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
                  {routed.length === 0 && <tr><td colSpan={9} className={`py-10 text-center ${embedded ? "text-muted-foreground" : "text-white/30"}`}>No routed applications</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Expansion Queue */}
          {tab === "expansion" && (
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
                  {expansion.map((a, i) => (
                    <tr key={a.id} className={`border-b ${embedded ? "border-border hover:bg-muted/40" : "border-white/5 hover:bg-[#1ABC9C]/5"} transition-colors ${i % 2 === 0 && !embedded ? "bg-white/[0.02]" : ""}`}>
                      <td className={`py-3 px-3 ${embedded ? "text-foreground" : "text-white"}`}>{a.full_name}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.company_name}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.country}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.commodity}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.invoice_size}</td>
                      {renderRowControls(a)}
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
                  {expansion.length === 0 && <tr><td colSpan={9} className={`py-10 text-center ${embedded ? "text-muted-foreground" : "text-white/30"}`}>No applications in expansion queue</td></tr>}
                </tbody>
              </table>
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
                          {partnerStatuses.map(s => <option key={s} value={s}>{s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>)}
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
