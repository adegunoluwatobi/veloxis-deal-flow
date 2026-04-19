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
}
