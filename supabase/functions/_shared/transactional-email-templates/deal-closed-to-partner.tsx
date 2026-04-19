/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  partnerAdminName?: string
  dealReference: string
  exporterCompanyName: string
  dealUrl: string
}

const Email = ({ partnerAdminName, dealReference, exporterCompanyName, dealUrl }: Props) => (
  <VeloxisLayout
    preview={`Application ${dealReference} closed for ${exporterCompanyName}`}
  >
    <Heading style={styles.h1}>Application closed</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Application <strong>{dealReference}</strong> for <strong>{exporterCompanyName}</strong> has been closed —
      the exporter has confirmed receipt of their residual.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Application ${data?.dealReference ?? ''} closed — ${data?.exporterCompanyName ?? ''}`,
  displayName: 'Deal closed (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    dealReference: 'VLX-2026-0042',
    exporterCompanyName: 'Sahara Foods Ltd',
    dealUrl: 'https://app.veloxis.co.uk/greystar/deals/preview',
  },
} satisfies TemplateEntry

export default Email
