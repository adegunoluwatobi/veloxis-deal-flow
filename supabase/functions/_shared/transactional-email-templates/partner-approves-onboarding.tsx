/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  exporterContactName?: string
  partnerOrganisationName: string
  dashboardUrl: string
}

const Email = ({ exporterContactName, partnerOrganisationName, dashboardUrl }: Props) => (
  <VeloxisLayout
    preview={`Your Veloxis onboarding has been approved by ${partnerOrganisationName}`}
  >
    <Heading style={styles.h1}>Your onboarding has been approved</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Great news — your onboarding application has been reviewed and approved by{' '}
      <strong>{partnerOrganisationName}</strong>.
    </Text>
    <Text style={styles.text}>
      Your application has been forwarded to the Veloxis team for final review. We will
      be in touch shortly.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dashboardUrl}>View Your Dashboard</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Your Veloxis onboarding has been approved by ${data?.partnerOrganisationName ?? 'your partner'}`,
  displayName: 'Partner approves onboarding (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    partnerOrganisationName: 'Greystar Capital',
    dashboardUrl: 'https://app.veloxis.co.uk/exporter',
  },
} satisfies TemplateEntry

export default Email
