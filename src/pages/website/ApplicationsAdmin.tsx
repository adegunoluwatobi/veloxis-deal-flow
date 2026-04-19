import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import veloxisLogoWhite from "@/assets/veloxis-logo-white.png";
import PipelineStatusBadge from "@/components/PipelineStatusBadge";
import { pipelineStatusLabel, type PipelineStatus } from "@/lib/pipelineStatus";
import { formatEntityType } from "@/types";
import { sendOnboardingEmail, resolvePartnerAdminRecipient, appUrl } from "@/lib/sendOnboardingEmail";

const C = { deepEmerald: "#0B3D2E", accent: "#1ABC9C" };
const inputBg = "rgba(255,255,255,0.04)";

type ExporterApp = {
  id: string;
  full_name: string;
  company_name: string;
  country: string;
  commodity: string;
  buyer_countries: string[];
  invoice_size: string;
  shipment_frequency: string;
  email: string;
  phone: string;
  deal_description: string | null;
  assigned_partner: string | null;
  assigned_partner_id: string | null;
  exporter_id: string | null;
  status: string; // legacy app status, kept for back-compat only
  expansion_activated: boolean;
  admin_notes: string | null;
  created_at: string;
  // joined from exporters
  exporter_pipeline_status: PipelineStatus | null;
  exporter_entity_type: string | null;
  exporter_originator_id: string | null;
  exporter_expansion_override: boolean;
  exporter_routed_at: string | null;
  exporter_forwarded_at: string | null;
  exporter_activated_at: string | null;
};

type PartnerApp = {
  id: string;
  full_name: string;
  company_name: string;
  countries_covered: string[];
  partner_type: string;
  sectors: string[];
  network_size: string;
  email: string;
  phone: string;
  description: string | null;
  website: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};
type PartnerOrg = { id: string; name: string; country: string | null };

const partnerStatuses = ["under_review", "approved", "rejected", "on_hold"];

interface ApplicationsAdminProps {
  embedded?: boolean;
}

export default function ApplicationsAdmin({ embedded = false }: ApplicationsAdminProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"pipeline" | "expansion" | "partners">("pipeline");
  const [exporterApps, setExporterApps] = useState<ExporterApp[]>([]);
  const [partnerApps, setPartnerApps] = useState<PartnerApp[]>([]);
  const [partnerOrgs, setPartnerOrgs] = useState<PartnerOrg[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingAssign, setPendingAssign] = useState<{ app: ExporterApp; partner: PartnerOrg } | null>(null);
  const [pendingActivate, setPendingActivate] = useState<ExporterApp | null>(null);
  const [pendingReject, setPendingReject] = useState<ExporterApp | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    loadData();
  }, [authLoading, user, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const loadData = async () => {
    setLoading(true);
    const [{ data: exp }, { data: part }, { data: orgs }] = await Promise.all([
      supabase
        .from("exporter_applications" as any)
        .select(
          `*, exporter:exporters(pipeline_status, entity_type, originator_id, expansion_override, routed_at, forwarded_to_veloxis_at, activated_at)`,
        )
        .order("created_at", { ascending: false }),
      supabase.from("partner_applications" as any).select("*").order("created_at", { ascending: false }),
      supabase
        .from("partner_organisations")
        .select("id, name, country")
        .eq("is_active", true)
        .order("name"),
    ]);
    const rows: ExporterApp[] = ((exp as any[]) ?? []).map((a) => ({
      ...a,
      exporter_pipeline_status: a.exporter?.pipeline_status ?? null,
      exporter_entity_type: a.exporter?.entity_type ?? null,
      exporter_originator_id: a.exporter?.originator_id ?? null,
      exporter_expansion_override: a.exporter?.expansion_override ?? false,
      exporter_routed_at: a.exporter?.routed_at ?? null,
      exporter_forwarded_at: a.exporter?.forwarded_to_veloxis_at ?? null,
      exporter_activated_at: a.exporter?.activated_at ?? null,
    }));
    setExporterApps(rows);
    setPartnerApps((part as any) || []);
    setPartnerOrgs((orgs as any) || []);
    setLoading(false);
  };

  const updateExporterNotes = async (id: string) => {
    const notes = editingNotes[id] ?? "";
    await supabase.from("exporter_applications" as any).update({ admin_notes: notes } as any).eq("id", id);
    setExporterApps((p) => p.map((a) => (a.id === id ? { ...a, admin_notes: notes } : a)));
  };

  const updatePartnerStatus = async (id: string, status: string) => {
    await supabase.from("partner_applications" as any).update({ status } as any).eq("id", id);
    setPartnerApps((p) => p.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const updatePartnerNotes = async (id: string) => {
    const notes = editingNotes[id] ?? "";
    await supabase.from("partner_applications" as any).update({ admin_notes: notes } as any).eq("id", id);
    setPartnerApps((p) => p.map((a) => (a.id === id ? { ...a, admin_notes: notes } : a)));
  };

  // Active partner organisations covering a given country
  const activePartnersForCountry = (country: string) =>
    partnerOrgs.filter((p) => (p.country ?? "").toLowerCase() === (country ?? "").toLowerCase());

  // Toggle the manual Expansion override on the exporter row.
  const setExpansionOverride = async (a: ExporterApp, on: boolean) => {
    if (!a.exporter_id) return;
    setBusyId(a.id);
    try {
      await supabase.from("exporters").update({ expansion_override: on } as any).eq("id", a.exporter_id);
      await loadData();
    } finally {
      setBusyId(null);
    }
  };

  // Step 1: dropdown change → confirm modal
  const requestAssignPartner = (app: ExporterApp, partnerOrgId: string) => {
    if (!partnerOrgId) return;
    const partner = partnerOrgs.find((p) => p.id === partnerOrgId);
    if (!partner) return;
    setPendingAssign({ app, partner });
  };

  // Step 2: confirm → write through. Sets exporters.routed_at + originator,
  // which the DB trigger uses to compute pipeline_status = 'routed'.
  const confirmAssignPartner = async () => {
    if (!pendingAssign || !user) return;
    const { app, partner } = pendingAssign;
    setPendingAssign(null);
    setBusyId(app.id);
    try {
      const { data: originatorId, error: rpcErr } = await supabase.rpc(
        "default_originator_for_partner_org" as any,
        { p_org_id: partner.id } as any,
      );
      if (rpcErr) throw rpcErr;
      if (!originatorId) {
        toast.error(
          `${partner.name} has no partner_admin user configured. Add a partner admin before assigning exporters to this organisation.`,
        );
        setBusyId(null);
        return;
      }

      let exporterId = app.exporter_id;
      if (!exporterId) {
        const { data: newExp, error: insErr } = await supabase
          .from("exporters")
          .insert({
            company_name: app.company_name,
            rc_number: "",
            entity_type: "limited_company" as any,
            director_name: app.full_name,
            contact_email: app.email,
            country: app.country,
            originator_id: originatorId as string,
            is_active: true,
            routed_at: new Date().toISOString(),
            expansion_override: false,
          } as any)
          .select("id")
          .maybeSingle();
        if (insErr) throw insErr;
        exporterId = newExp?.id ?? null;
      } else {
        await supabase
          .from("exporters")
          .update({
            originator_id: originatorId as string,
            is_active: true,
            routed_at: new Date().toISOString(),
            expansion_override: false,
          } as any)
          .eq("id", exporterId);
      }

      await supabase
        .from("exporter_applications" as any)
        .update({
          status: "assigned",
          assigned_partner: partner.name,
          assigned_partner_id: partner.id,
          exporter_id: exporterId,
          expansion_activated: true,
        } as any)
        .eq("id", app.id);

      toast.success(`✓ ${app.company_name} successfully assigned to ${partner.name}`);
      await loadData();
    } catch (e: any) {
      toast.error(`Assignment failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setBusyId(null);
    }
  };

  const confirmActivate = async () => {
    if (!pendingActivate || !user) return;
    const a = pendingActivate;
    setPendingActivate(null);
    setBusyId(a.id);
    try {
      if (!a.exporter_id) {
        toast.error("This application has no linked exporter profile yet. Assign a partner first.");
        return;
      }
      const { error } = await supabase
        .from("exporters")
        .update({
          activated_at: new Date().toISOString(),
          activated_by: user.id,
          is_active: true,
          onboarding_status: "onboarding_approved" as any,
        } as any)
        .eq("id", a.exporter_id);
      if (error) throw error;
      await supabase.rpc("insert_audit_log", {
        p_exporter_id: a.exporter_id,
        p_user_id: user.id,
        p_user_role: "super_admin" as any,
        p_action_type: "onboarding_approved" as any,
        p_metadata: { source: "admin_pipeline" },
      });
      // Email #8 — Veloxis approves exporter (→ exporter + partner)
      try {
        const { data: exp } = await supabase
          .from('exporters')
          .select('id, company_name, contact_email, director_name, originator_id')
          .eq('id', a.exporter_id).maybeSingle();
        if (exp?.contact_email) {
          void sendOnboardingEmail({
            templateName: 'veloxis-approves-exporter-to-exporter',
            recipientEmail: exp.contact_email,
            idempotencyKey: `veloxis-approve-exporter-${exp.id}`,
            templateData: { exporterContactName: exp.director_name || '', loginUrl: appUrl('/login') },
          });
        }
        if (exp?.originator_id) {
          const { data: roleRow } = await supabase
            .from('user_roles').select('partner_organisation_id')
            .eq('user_id', exp.originator_id).in('role', ['partner_admin', 'partner_staff']).maybeSingle();
          const recipient = await resolvePartnerAdminRecipient(roleRow?.partner_organisation_id ?? null);
          if (recipient?.email) {
            void sendOnboardingEmail({
              templateName: 'veloxis-approves-exporter-to-partner',
              recipientEmail: recipient.email,
              idempotencyKey: `veloxis-approve-partner-${exp.id}`,
              templateData: {
                partnerAdminName: recipient.fullName,
                exporterCompanyName: exp.company_name,
                exporterUrl: appUrl(`/greystar/exporters/${exp.id}`),
              },
            });
          }
        }
      } catch (e) { console.warn('veloxis-approves emails failed', e); }
      toast.success(`✓ ${a.company_name} activated`);
      await loadData();
    } catch (e: any) {
      toast.error(`Activation failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!pendingReject || !user) return;
    if (!rejectReason.trim()) {
      toast.error("A rejection reason is required.");
      return;
    }
    const a = pendingReject;
    const reason = rejectReason.trim();
    setPendingReject(null);
    setRejectReason("");
    setBusyId(a.id);
    try {
      if (a.exporter_id) {
        await supabase
          .from("exporters")
          .update({
            rejected_at: new Date().toISOString(),
            rejected_by: user.id,
            rejection_reason: reason,
          } as any)
          .eq("id", a.exporter_id);
        await supabase.rpc("insert_audit_log", {
          p_exporter_id: a.exporter_id,
          p_user_id: user.id,
          p_user_role: "super_admin" as any,
          p_action_type: "onboarding_rejected" as any,
          p_metadata: { reason },
        });
      }
      await supabase
        .from("exporter_applications" as any)
        .update({ status: "rejected", admin_notes: reason } as any)
        .eq("id", a.id);
      // Email #9 — Veloxis rejects exporter (→ exporter + partner)
      try {
        if (a.exporter_id) {
          const { data: exp } = await supabase
            .from('exporters')
            .select('id, company_name, contact_email, director_name, originator_id')
            .eq('id', a.exporter_id).maybeSingle();
          if (exp?.contact_email) {
            void sendOnboardingEmail({
              templateName: 'veloxis-rejects-exporter-to-exporter',
              recipientEmail: exp.contact_email,
              idempotencyKey: `veloxis-reject-exporter-${exp.id}`,
              templateData: { exporterContactName: exp.director_name || '', rejectionReason: reason },
            });
          }
          if (exp?.originator_id) {
            const { data: roleRow } = await supabase
              .from('user_roles').select('partner_organisation_id')
              .eq('user_id', exp.originator_id).in('role', ['partner_admin', 'partner_staff']).maybeSingle();
            const recipient = await resolvePartnerAdminRecipient(roleRow?.partner_organisation_id ?? null);
            if (recipient?.email) {
              void sendOnboardingEmail({
                templateName: 'veloxis-rejects-exporter-to-partner',
                recipientEmail: recipient.email,
                idempotencyKey: `veloxis-reject-partner-${exp.id}`,
                templateData: {
                  partnerAdminName: recipient.fullName,
                  exporterCompanyName: exp.company_name,
                  rejectionReason: reason,
                  applicationUrl: appUrl(`/greystar/exporters/${exp.id}`),
                },
              });
            }
          }
        }
      } catch (e) { console.warn('veloxis-rejects emails failed', e); }
      toast.success(`Application rejected`);
      await loadData();
    } catch (e: any) {
      toast.error(`Rejection failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setBusyId(null);
    }
  };

  // Effective pipeline status for a row (joined from exporters when present;
  // otherwise derived from the application's own state).
  const effectiveStatus = (a: ExporterApp): PipelineStatus => {
    if (a.exporter_pipeline_status) return a.exporter_pipeline_status;
    if (a.exporter_expansion_override) return "expansion";
    if (a.assigned_partner_id) return "routed";
    return "invited";
  };

  // Pipeline tab = anything that is not yet activated or rejected.
  const pipelineRows = exporterApps.filter((a) => {
    const s = effectiveStatus(a);
    return s !== "approved" && s !== "rejected" && s !== "expansion";
  });
  const expansionRows = exporterApps.filter((a) => effectiveStatus(a) === "expansion");

  const tabs = [
    { key: "pipeline" as const, label: "Registration Pipeline", count: pipelineRows.length },
    { key: "expansion" as const, label: "Expansion Queue", count: expansionRows.length },
    { key: "partners" as const, label: "Partner Applications", count: partnerApps.length },
  ];

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  if (authLoading || !user) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.deepEmerald }}>
        <Loader2 className="w-6 h-6 text-[#1ABC9C] animate-spin" />
      </div>
    );
  }

  // Per-row partner cell: dropdown when no partner assigned and partners exist.
  // Otherwise show the assigned partner name (or amber warning if status is
  // "routed" with no partner — a data-integrity inconsistency).
  const renderPartnerCell = (a: ExporterApp) => {
    const choices = activePartnersForCountry(a.country);
    const disabled = busyId === a.id;
    const status = effectiveStatus(a);
    const inconsistent = status === "routed" && !a.assigned_partner_id;

    if (a.assigned_partner_id) {
      return (
        <span className={embedded ? "text-foreground text-[12px]" : "text-white text-[12px]"}>
          {a.assigned_partner ?? "—"}
        </span>
      );
    }

    if (inconsistent) {
      return (
        <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3" /> Routed without partner
        </span>
      );
    }

    if (choices.length === 0) {
      return (
        <span className={embedded ? "text-muted-foreground text-[12px]" : "text-white/40 text-[12px]"}>
          No partner in {a.country}
        </span>
      );
    }

    return (
      <select
        disabled={disabled}
        value=""
        onChange={(e) => requestAssignPartner(a, e.target.value)}
        className={`rounded px-2 py-1 text-[12px] outline-none disabled:opacity-50 ${
          embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"
        }`}
        style={embedded ? undefined : { background: inputBg }}
      >
        <option value="">— Unassigned —</option>
        {choices.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    );
  };

  // Action cell for the Pipeline tab. Shows admin "Approve & Activate" /
  // "Reject" once partner has forwarded; "Expansion override" only when no
  // partner is available; never a free-text manual status dropdown.
  const renderActionsCell = (a: ExporterApp) => {
    const status = effectiveStatus(a);
    const disabled = busyId === a.id;
    const partnerCount = activePartnersForCountry(a.country).length;
    const canExpansionOverride = !a.assigned_partner_id && partnerCount === 0 && a.exporter_id;

    return (
      <div className="flex flex-wrap gap-1.5">
        {status === "pending_veloxis" || status === "routed" ? (
          <>
            <Button
              size="sm"
              variant="default"
              disabled={disabled || !a.exporter_id}
              className="h-7 text-[11px]"
              onClick={() => setPendingActivate(a)}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" /> Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className="h-7 text-[11px] text-destructive border-destructive/40"
              onClick={() => {
                setPendingReject(a);
                setRejectReason("");
              }}
            >
              <XCircle className="mr-1 h-3 w-3" /> Reject
            </Button>
          </>
        ) : null}

        {canExpansionOverride && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            className="h-7 text-[11px]"
            onClick={() => setExpansionOverride(a, true)}
          >
            Move to Expansion
          </Button>
        )}

        {status === "expansion" && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            className="h-7 text-[11px]"
            onClick={() => setExpansionOverride(a, false)}
          >
            Return to Pipeline
          </Button>
        )}
      </div>
    );
  };

  const renderPipelineTable = (rows: ExporterApp[], emptyMsg: string) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className={`border-b ${embedded ? "border-border" : "border-white/10"}`}>
            {[
              "Name",
              "Company",
              "Entity Type",
              "Country",
              "Commodity",
              "Invoice Size",
              "Assigned Partner",
              "Status",
              "Submitted",
              "Actions",
              "Admin Notes",
            ].map((h) => (
              <th
                key={h}
                className={`py-3 px-3 text-[11px] font-semibold uppercase tracking-wider ${
                  embedded ? "text-muted-foreground" : "text-white/30"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => {
            const status = effectiveStatus(a);
            const inconsistent = status === "routed" && !a.assigned_partner_id;
            return (
              <tr
                key={a.id}
                className={`border-b ${
                  embedded ? "border-border hover:bg-muted/40" : "border-white/5 hover:bg-[#1ABC9C]/5"
                } transition-colors ${inconsistent ? "bg-amber-500/5" : i % 2 === 0 && !embedded ? "bg-white/[0.02]" : ""}`}
              >
                <td className={`py-3 px-3 ${embedded ? "text-foreground" : "text-white"}`}>{a.full_name}</td>
                <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.company_name}</td>
                <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>
                  {formatEntityType(a.exporter_entity_type)}
                </td>
                <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.country}</td>
                <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.commodity}</td>
                <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.invoice_size}</td>
                <td className="py-3 px-3">{renderPartnerCell(a)}</td>
                <td className="py-3 px-3">
                  <PipelineStatusBadge status={status} />
                </td>
                <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/40"}`}>{fmtDate(a.created_at)}</td>
                <td className="py-3 px-3">{renderActionsCell(a)}</td>
                <td className="py-3 px-3">
                  <input
                    className={`w-full rounded px-2 py-1 text-[12px] outline-none ${
                      embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"
                    }`}
                    style={embedded ? undefined : { background: inputBg }}
                    placeholder="Add notes"
                    value={editingNotes[a.id] ?? a.admin_notes ?? ""}
                    onChange={(e) => setEditingNotes((p) => ({ ...p, [a.id]: e.target.value }))}
                    onBlur={() => updateExporterNotes(a.id)}
                  />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className={`py-10 text-center ${embedded ? "text-muted-foreground" : "text-white/30"}`}>
                {emptyMsg}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const Inner = (
    <>
      {/* Tabs */}
      <div className={`flex gap-1 mb-8 border-b ${embedded ? "border-border" : "border-white/10"}`}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-[13px] font-medium transition-colors border-b-2 ${
                active
                  ? embedded
                    ? "border-primary text-primary"
                    : "border-[#1ABC9C] text-[#5FFFD7]"
                  : embedded
                    ? "border-transparent text-muted-foreground hover:text-foreground"
                    : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              {t.label}{" "}
              <span
                className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${
                  embedded ? "bg-muted text-muted-foreground" : "bg-white/10"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className={`w-6 h-6 animate-spin ${embedded ? "text-primary" : "text-[#1ABC9C]"}`} />
        </div>
      ) : (
        <>
          {tab === "pipeline" && renderPipelineTable(pipelineRows, "No applications in pipeline")}
          {tab === "expansion" && renderPipelineTable(expansionRows, "No applications in expansion queue")}

          {/* Partner Applications */}
          {tab === "partners" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className={`border-b ${embedded ? "border-border" : "border-white/10"}`}>
                    {[
                      "Name",
                      "Company",
                      "Countries",
                      "Partner Type",
                      "Network Size",
                      "Email",
                      "Phone",
                      "Status",
                      "Submitted",
                      "Admin Notes",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`py-3 px-3 text-[11px] font-semibold uppercase tracking-wider ${
                          embedded ? "text-muted-foreground" : "text-white/30"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partnerApps.map((a, i) => (
                    <tr
                      key={a.id}
                      className={`border-b ${
                        embedded ? "border-border hover:bg-muted/40" : "border-white/5 hover:bg-[#1ABC9C]/5"
                      } transition-colors ${i % 2 === 0 && !embedded ? "bg-white/[0.02]" : ""}`}
                    >
                      <td className={`py-3 px-3 ${embedded ? "text-foreground" : "text-white"}`}>{a.full_name}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.company_name}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>
                        {(a.countries_covered || []).join(", ")}
                      </td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.partner_type}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.network_size}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.email}</td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/60"}`}>{a.phone}</td>
                      <td className="py-3 px-3">
                        <select
                          value={a.status}
                          onChange={(e) => updatePartnerStatus(a.id, e.target.value)}
                          className={`rounded px-2 py-1 text-[12px] outline-none ${
                            embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"
                          }`}
                          style={embedded ? undefined : { background: inputBg }}
                        >
                          {partnerStatuses.map((s) => (
                            <option key={s} value={s}>
                              {s
                                .split("_")
                                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(" ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`py-3 px-3 ${embedded ? "text-muted-foreground" : "text-white/40"}`}>{fmtDate(a.created_at)}</td>
                      <td className="py-3 px-3">
                        <input
                          className={`w-full rounded px-2 py-1 text-[12px] outline-none ${
                            embedded ? "bg-background border border-border text-foreground" : "text-white border border-white/10"
                          }`}
                          style={embedded ? undefined : { background: inputBg }}
                          placeholder="Add notes"
                          value={editingNotes[a.id] ?? a.admin_notes ?? ""}
                          onChange={(e) => setEditingNotes((p) => ({ ...p, [a.id]: e.target.value }))}
                          onBlur={() => updatePartnerNotes(a.id)}
                        />
                      </td>
                    </tr>
                  ))}
                  {partnerApps.length === 0 && (
                    <tr>
                      <td colSpan={10} className={`py-10 text-center ${embedded ? "text-muted-foreground" : "text-white/30"}`}>
                        No partner applications yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Confirm assign partner */}
      <AlertDialog open={!!pendingAssign} onOpenChange={(open) => { if (!open) setPendingAssign(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Partner Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to assign <span className="font-semibold text-foreground">{pendingAssign?.app.company_name}</span> to{" "}
              <span className="font-semibold text-foreground">{pendingAssign?.partner.name}</span>. This will route the application
              to that partner for onboarding review. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAssignPartner}
              style={{ backgroundColor: "#0BA4A4", color: "white" }}
              className="hover:opacity-90"
            >
              Confirm Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm activate exporter */}
      <AlertDialog open={!!pendingActivate} onOpenChange={(open) => { if (!open) setPendingActivate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve & Activate Exporter</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to grant <span className="font-semibold text-foreground">{pendingActivate?.company_name}</span> full
              platform access. They will be able to sign in, submit deals, and appear in the active Exporters directory. This is
              the final approval step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmActivate}
              style={{ backgroundColor: "#0BA4A4", color: "white" }}
              className="hover:opacity-90"
            >
              Approve & Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm reject application */}
      <AlertDialog open={!!pendingReject} onOpenChange={(open) => { if (!open) { setPendingReject(null); setRejectReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for rejecting <span className="font-semibold text-foreground">{pendingReject?.company_name}</span>.
              This will be recorded in the audit trail and visible to the partner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for rejection (required)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Registration Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Status updates automatically as exporters move through onboarding. Statuses below are computed — they cannot be set
            manually except for the Expansion override.
          </p>
        </div>
        {Inner}
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.deepEmerald }}>
      <nav className="flex items-center justify-between px-8 py-3" style={{ borderBottom: "0.5px solid rgba(26,188,156,0.12)" }}>
        <Link to="/">
          <img src={veloxisLogoWhite} alt="Veloxis" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[13px] text-white/40">Applications Admin</span>
          <button
            onClick={handleSignOut}
            className="text-[12px] text-[#1ABC9C] border border-[#1ABC9C]/30 px-3 py-1 rounded hover:bg-[#1ABC9C]/10 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-[1200px] px-8 py-8">{Inner}</div>
    </div>
  );
}
