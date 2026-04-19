/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  dealReference: string
  buyerCompanyName: string
  repaymentDueDate: string
  amountDisplay?: string
  dealUrl: string
}

const Email = ({
  recipientName,
  dealReference,
  buyerCompanyName,
  repaymentDueDate,
  amountDisplay,
  dealUrl,
}: Props) => (
  <VeloxisLayout preview={`${dealReference} matures tomorrow`}>
    <Heading style={styles.h1}>Repayment is due tomorrow</Heading>
    <Text style={styles.text}>Hi {recipientName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Application <strong>{dealReference}</strong> with buyer <strong>{buyerCompanyName}</strong> matures{' '}
      <strong>tomorrow ({repaymentDueDate})</strong>
      {amountDisplay ? <> for <strong>{amountDisplay}</strong></> : null}.
    </Text>
    <Text style={styles.text}>
      If buyer payment is not received in full by the maturity date, daily late penalties will begin to accrue and
      the application moves into the overdue queue.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Final reminder: ${data?.dealReference ?? 'Your application'} matures tomorrow`,
  displayName: 'Maturity reminder — 1 day',
  previewData: {
    recipientName: 'Adaeze',
    dealReference: 'VLX-2026-0042',
    buyerCompanyName: 'Acme Trading Ltd',
    repaymentDueDate: '20 Apr 2026',
    amountDisplay: 'USD 120,000.00',
    dealUrl: 'https://app.veloxis.co.uk/exporter/deals/preview',
  },
} satisfies TemplateEntry

export default Email
