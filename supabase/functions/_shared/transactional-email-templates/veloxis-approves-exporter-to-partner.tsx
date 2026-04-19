/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  partnerAdminName?: string
  exporterCompanyName: string
  exporterUrl: string
}

const Email = ({ partnerAdminName, exporterCompanyName, exporterUrl }: Props) => (
  <VeloxisLayout preview={`${exporterCompanyName} has been approved by Veloxis`}>
    <Heading style={styles.h1}>Exporter approved by Veloxis</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Veloxis has completed their review and approved <strong>{exporterCompanyName}</strong>.
      Their account is now active on the platform.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={exporterUrl}>View Exporter Profile</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `${data?.exporterCompanyName ?? 'An exporter'} has been approved by Veloxis`,
  displayName: 'Veloxis approves exporter (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    exporterCompanyName: 'Sahara Foods Ltd',
    exporterUrl: 'https://app.veloxis.co.uk/greystar/exporters/preview',
  },
} satisfies TemplateEntry

export default Email
