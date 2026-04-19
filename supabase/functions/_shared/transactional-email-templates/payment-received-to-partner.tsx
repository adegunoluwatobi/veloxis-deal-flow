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
  invoiceCurrency: string
  amountReceived: string
  residualBalance: string
  dealUrl: string
}

const Email = ({
  partnerAdminName,
  dealReference,
  exporterCompanyName,
  invoiceCurrency,
  amountReceived,
  residualBalance,
  dealUrl,
}: Props) => (
  <VeloxisLayout
    preview={`Buyer payment received for ${exporterCompanyName} application ${dealReference}`}
  >
    <Heading style={styles.h1}>Buyer payment received</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Veloxis has received <strong>{invoiceCurrency} {amountReceived}</strong> from the buyer for application{' '}
      <strong>{dealReference}</strong> (<strong>{exporterCompanyName}</strong>).
    </Text>
    <Text style={styles.text}>
      <strong>Residual balance to remit:</strong> {invoiceCurrency} {residualBalance}
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Payment received: ${data?.dealReference ?? ''} — ${data?.exporterCompanyName ?? ''}`,
  displayName: 'Payment received (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    dealReference: 'VLX-2026-0042',
    exporterCompanyName: 'Sahara Foods Ltd',
    invoiceCurrency: 'GBP',
    amountReceived: '125,000',
    residualBalance: '23,200',
    dealUrl: 'https://app.veloxis.co.uk/greystar/deals/preview',
  },
} satisfies TemplateEntry

export default Email
