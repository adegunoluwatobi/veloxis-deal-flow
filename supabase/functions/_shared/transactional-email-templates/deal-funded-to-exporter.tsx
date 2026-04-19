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
  netAdvanceAmount: string
  disbursementDate: string
  repaymentDueDate: string
  dealUrl: string
}

const Email = ({
  exporterContactName,
  dealReference,
  invoiceCurrency,
  netAdvanceAmount,
  disbursementDate,
  repaymentDueDate,
  dealUrl,
}: Props) => (
  <VeloxisLayout
    preview={`${invoiceCurrency} ${netAdvanceAmount} disbursed for application ${dealReference}`}
  >
    <Heading style={styles.h1}>Your advance has been funded</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Veloxis has disbursed <strong>{invoiceCurrency} {netAdvanceAmount}</strong> for application{' '}
      <strong>{dealReference}</strong>.
    </Text>
    <Text style={styles.text}>
      <strong>Disbursement date:</strong> {disbursementDate}<br />
      <strong>Repayment due date:</strong> {repaymentDueDate}
    </Text>
    <Text style={styles.text}>
      Funds should arrive in your verified bank account within 1 business day.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Funds disbursed for application ${data?.dealReference ?? ''}`,
  displayName: 'Deal funded (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    dealReference: 'VLX-2026-0042',
    invoiceCurrency: 'GBP',
    netAdvanceAmount: '96,500',
    disbursementDate: '19 Apr 2026',
    repaymentDueDate: '19 May 2026',
    dealUrl: 'https://app.veloxis.co.uk/exporter/deals/preview',
  },
} satisfies TemplateEntry

export default Email
