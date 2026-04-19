/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  exporterContactName?: string
  dealReference: string
  buyerCompanyName: string
  invoiceCurrency: string
  invoiceValue: string
  advanceAmount: string
  netAdvanceAmount: string
  dealUrl: string
}

const Email = ({
  exporterContactName,
  dealReference,
  buyerCompanyName,
  invoiceCurrency,
  invoiceValue,
  advanceAmount,
  netAdvanceAmount,
  dealUrl,
}: Props) => (
  <VeloxisLayout preview={`Application ${dealReference} approved — awaiting buyer IPU signature`}>
    <Heading style={styles.h1}>Your application has been approved</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Great news — application <strong>{dealReference}</strong> for buyer <strong>{buyerCompanyName}</strong> has
      been approved by Veloxis.
    </Text>
    <Text style={styles.text}>
      <strong>Invoice value:</strong> {invoiceCurrency} {invoiceValue}<br />
      <strong>Advance amount:</strong> {invoiceCurrency} {advanceAmount}<br />
      <strong>Net advance to you:</strong> {invoiceCurrency} {netAdvanceAmount}
    </Text>
    <Text style={styles.text}>
      The next step is for your buyer to sign the Irrevocable Payment Undertaking (IPU). We will notify you the moment that's done and disbursement begins.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Application ${data?.dealReference ?? ''} approved — awaiting buyer IPU`,
  displayName: 'Deal approved (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    dealReference: 'VLX-2026-0042',
    buyerCompanyName: 'Acme Trading Ltd',
    invoiceCurrency: 'GBP',
    invoiceValue: '125,000',
    advanceAmount: '100,000',
    netAdvanceAmount: '96,500',
    dealUrl: 'https://app.veloxis.co.uk/exporter/deals/preview',
  },
} satisfies TemplateEntry

export default Email
