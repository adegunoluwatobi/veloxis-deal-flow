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
  repaymentDueDate: string
  dealUrl: string
}

const Email = ({
  exporterContactName,
  dealReference,
  buyerCompanyName,
  repaymentDueDate,
  dealUrl,
}: Props) => (
  <VeloxisLayout preview={`Application ${dealReference} is now overdue`}>
    <Heading style={styles.h1}>Your application is overdue</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Application <strong>{dealReference}</strong> with buyer <strong>{buyerCompanyName}</strong> passed its repayment
      due date of <strong>{repaymentDueDate}</strong> without buyer payment being received.
    </Text>
    <Text style={styles.text}>
      Daily late penalties are now accruing. Please contact your buyer to expedite payment, and reach out to your
      Veloxis contact if you need support.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Application ${data?.dealReference ?? ''} is overdue — late penalties accruing`,
  displayName: 'Deal overdue (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    dealReference: 'VLX-2026-0042',
    buyerCompanyName: 'Acme Trading Ltd',
    repaymentDueDate: '19 May 2026',
    dealUrl: 'https://app.veloxis.co.uk/exporter/deals/preview',
  },
} satisfies TemplateEntry

export default Email
