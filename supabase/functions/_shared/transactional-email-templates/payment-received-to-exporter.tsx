/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  exporterContactName?: string
  dealReference: string
  invoiceCurrency: string
  amountReceived: string
  residualBalance: string
  dealUrl: string
}

const Email = ({
  exporterContactName,
  dealReference,
  invoiceCurrency,
  amountReceived,
  residualBalance,
  dealUrl,
}: Props) => (
  <VeloxisLayout preview={`Buyer payment received for application ${dealReference}`}>
    <Heading style={styles.h1}>Buyer payment received</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Veloxis has received <strong>{invoiceCurrency} {amountReceived}</strong> from your buyer for application{' '}
      <strong>{dealReference}</strong>.
    </Text>
    <Text style={styles.text}>
      <strong>Residual balance owed to you:</strong> {invoiceCurrency} {residualBalance}
    </Text>
    <Text style={styles.text}>
      We will remit the residual to your verified bank account shortly. You'll be asked to confirm receipt to close the application.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Buyer payment received for ${data?.dealReference ?? ''}`,
  displayName: 'Payment received (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    dealReference: 'VLX-2026-0042',
    invoiceCurrency: 'GBP',
    amountReceived: '125,000',
    residualBalance: '23,200',
    dealUrl: 'https://app.veloxis.co.uk/exporter/deals/preview',
  },
} satisfies TemplateEntry

export default Email
