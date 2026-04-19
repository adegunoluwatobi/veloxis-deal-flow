/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  partnerAdminName?: string
  exporterCompanyName: string
  dashboardUrl: string
}

const Email = ({ partnerAdminName, exporterCompanyName, dashboardUrl }: Props) => (
  <VeloxisLayout preview={`${exporterCompanyName} has accepted their invitation`}>
    <Heading style={styles.h1}>Exporter invitation accepted</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      <strong>{exporterCompanyName}</strong> has accepted their invitation and started
      their onboarding on Veloxis.
    </Text>
    <Text style={styles.text}>You can monitor their progress in your partner dashboard.</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dashboardUrl}>View Onboarding Progress</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `${data?.exporterCompanyName ?? 'An exporter'} has accepted their invitation`,
  displayName: 'Exporter accepted invite (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    exporterCompanyName: 'Sahara Foods Ltd',
    dashboardUrl: 'https://app.veloxis.co.uk/greystar/exporters/preview',
  },
} satisfies TemplateEntry

export default Email
