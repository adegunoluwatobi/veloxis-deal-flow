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
  daysRemaining: number
  amountDisplay?: string
  dealUrl: string
}

const Email = ({
  recipientName,
  dealReference,
  buyerCompanyName,
  repaymentDueDate,
  daysRemaining,
  amountDisplay,
  dealUrl,
}: Props) => (
  <VeloxisLayout preview={`${dealReference} matures in ${daysRemaining} days`}>
    <Heading style={styles.h1}>Repayment is due in one week</Heading>
    <Text style={styles.text}>Hi {recipientName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Application <strong>{dealReference}</strong> with buyer <strong>{buyerCompanyName}</strong> matures on{' '}
      <strong>{repaymentDueDate}</strong>{amountDisplay ? <> for <strong>{amountDisplay}</strong></> : null}.
      That's {daysRemaining} day{daysRemaining === 1 ? '' : 's'} away.
    </Text>
    <Text style={styles.text}>
      Please confirm with your buyer that funds will be remitted to the verified domiciliary account on or before
      the maturity date.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Reminder: ${data?.dealReference ?? 'Your application'} matures in ${data?.daysRemaining ?? 7} days`,
  displayName: 'Maturity reminder — 7 days',
  previewData: {
    recipientName: 'Adaeze',
    dealReference: 'VLX-2026-0042',
    buyerCompanyName: 'Acme Trading Ltd',
    repaymentDueDate: '26 Apr 2026',
    daysRemaining: 7,
    amountDisplay: 'USD 120,000.00',
    dealUrl: 'https://app.veloxis.co.uk/exporter/deals/preview',
  },
} satisfies TemplateEntry

export default Email
