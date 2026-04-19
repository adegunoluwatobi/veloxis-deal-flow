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
  buyerCompanyName: string
  repaymentDueDate: string
  dealUrl: string
}

const Email = ({
  partnerAdminName,
  dealReference,
  exporterCompanyName,
  buyerCompanyName,
  repaymentDueDate,
  dealUrl,
}: Props) => (
  <VeloxisLayout
    preview={`${exporterCompanyName} application ${dealReference} is overdue`}
  >
    <Heading style={styles.h1}>Application overdue — action may be required</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Application <strong>{dealReference}</strong> for <strong>{exporterCompanyName}</strong> (buyer:{' '}
      {buyerCompanyName}) passed its repayment due date of <strong>{repaymentDueDate}</strong>.
    </Text>
    <Text style={styles.text}>
      Daily late penalties are now accruing. Please coordinate with the exporter to follow up with the buyer.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Overdue: ${data?.dealReference ?? ''} — ${data?.exporterCompanyName ?? ''}`,
  displayName: 'Deal overdue (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    dealReference: 'VLX-2026-0042',
    exporterCompanyName: 'Sahara Foods Ltd',
    buyerCompanyName: 'Acme Trading Ltd',
    repaymentDueDate: '19 May 2026',
    dealUrl: 'https://app.veloxis.co.uk/greystar/deals/preview',
  },
} satisfies TemplateEntry

export default Email
