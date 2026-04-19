/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

// Stage 1 — Onboarding lifecycle (Emails 1–9, with #8 and #9 split into
// per-recipient templates).
import { template as exporterInvitation } from './exporter-invitation.tsx'
import { template as exporterAcceptedInvite } from './exporter-accepted-invite.tsx'
import { template as onboardingFormSubmitted } from './onboarding-form-submitted.tsx'
import { template as kycDocumentsUploaded } from './kyc-documents-uploaded.tsx'
import { template as partnerApprovesOnboarding } from './partner-approves-onboarding.tsx'
import { template as partnerRejectsOnboarding } from './partner-rejects-onboarding.tsx'
import { template as partnerForwardsToVeloxis } from './partner-forwards-to-veloxis.tsx'
import { template as veloxisApprovesExporterToExporter } from './veloxis-approves-exporter-to-exporter.tsx'
import { template as veloxisApprovesExporterToPartner } from './veloxis-approves-exporter-to-partner.tsx'
import { template as veloxisRejectsExporterToExporter } from './veloxis-rejects-exporter-to-exporter.tsx'
import { template as veloxisRejectsExporterToPartner } from './veloxis-rejects-exporter-to-partner.tsx'

// Stage 2 — Deal lifecycle (Emails 10–16). Each lifecycle event has a
// dedicated template per recipient (exporter / partner) so wording stays
// audience-appropriate.
import { template as dealApprovedToExporter } from './deal-approved-to-exporter.tsx'
import { template as dealApprovedToPartner } from './deal-approved-to-partner.tsx'
import { template as ipuSignedToExporter } from './ipu-signed-to-exporter.tsx'
import { template as dealFundedToExporter } from './deal-funded-to-exporter.tsx'
import { template as dealFundedToPartner } from './deal-funded-to-partner.tsx'
import { template as dealOverdueToExporter } from './deal-overdue-to-exporter.tsx'
import { template as dealOverdueToPartner } from './deal-overdue-to-partner.tsx'
import { template as paymentReceivedToExporter } from './payment-received-to-exporter.tsx'
import { template as paymentReceivedToPartner } from './payment-received-to-partner.tsx'
import { template as dealClosedToExporter } from './deal-closed-to-exporter.tsx'
import { template as dealClosedToPartner } from './deal-closed-to-partner.tsx'

// Stage 3 — Scheduled reminders (cron-driven, dedup via idempotencyKey).
import { template as documentExpiry30 } from './document-expiry-30.tsx'
import { template as documentExpiry7 } from './document-expiry-7.tsx'
import { template as ipuPendingReminder } from './ipu-pending-reminder.tsx'
import { template as maturityReminder7 } from './maturity-reminder-7.tsx'
import { template as maturityReminder1 } from './maturity-reminder-1.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'exporter-invitation': exporterInvitation,
  'exporter-accepted-invite': exporterAcceptedInvite,
  'onboarding-form-submitted': onboardingFormSubmitted,
  'kyc-documents-uploaded': kycDocumentsUploaded,
  'partner-approves-onboarding': partnerApprovesOnboarding,
  'partner-rejects-onboarding': partnerRejectsOnboarding,
  'partner-forwards-to-veloxis': partnerForwardsToVeloxis,
  'veloxis-approves-exporter-to-exporter': veloxisApprovesExporterToExporter,
  'veloxis-approves-exporter-to-partner': veloxisApprovesExporterToPartner,
  'veloxis-rejects-exporter-to-exporter': veloxisRejectsExporterToExporter,
  'veloxis-rejects-exporter-to-partner': veloxisRejectsExporterToPartner,
  'deal-approved-to-exporter': dealApprovedToExporter,
  'deal-approved-to-partner': dealApprovedToPartner,
  'ipu-signed-to-exporter': ipuSignedToExporter,
  'deal-funded-to-exporter': dealFundedToExporter,
  'deal-funded-to-partner': dealFundedToPartner,
  'deal-overdue-to-exporter': dealOverdueToExporter,
  'deal-overdue-to-partner': dealOverdueToPartner,
  'payment-received-to-exporter': paymentReceivedToExporter,
  'payment-received-to-partner': paymentReceivedToPartner,
  'deal-closed-to-exporter': dealClosedToExporter,
  'deal-closed-to-partner': dealClosedToPartner,
  'document-expiry-30': documentExpiry30,
  'document-expiry-7': documentExpiry7,
  'ipu-pending-reminder': ipuPendingReminder,
  'maturity-reminder-7': maturityReminder7,
  'maturity-reminder-1': maturityReminder1,
}
