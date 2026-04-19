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
  netAdvanceAmount: string
  disbursementDate: string
  repaymentDueDate: string
  dealUrl: string
}

const Email = ({
  partnerAdminName,
  dealReference,
  exporterCompanyName,
  invoiceCurrency,
  netAdvanceAmount,
  disbursementDate,
  repaymentDueDate,
  dealUrl,
}: Props) => (
  <VeloxisLayout
    preview={`${invoiceCurrency} ${netAdvanceAmount} disbursed to ${exporterCompanyName}`}
  >
    <Heading style={styles.h1}>Application funded</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Veloxis has disbursed <strong>{invoiceCurrency} {netAdvanceAmount}</strong> to{' '}
      <strong>{exporterCompanyName}</strong> for application <strong>{dealReference}</strong>.
    </Text>
    <Text style={styles.text}>
      <strong>Disbursement date:</strong> {disbursementDate}<br />
      <strong>Repayment due date:</strong> {repaymentDueDate}
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Application ${data?.dealReference ?? ''} funded — ${data?.exporterCompanyName ?? ''}`,
  displayName: 'Deal funded (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    dealReference: 'VLX-2026-0042',
    exporterCompanyName: 'Sahara Foods Ltd',
    invoiceCurrency: 'GBP',
    netAdvanceAmount: '96,500',
    disbursementDate: '19 Apr 2026',
    repaymentDueDate: '19 May 2026',
    dealUrl: 'https://app.veloxis.co.uk/greystar/deals/preview',
  },
} satisfies TemplateEntry

export default Email
