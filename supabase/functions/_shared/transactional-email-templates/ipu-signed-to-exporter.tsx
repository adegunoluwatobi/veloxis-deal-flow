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
  dealUrl: string
}

const Email = ({ exporterContactName, dealReference, buyerCompanyName, dealUrl }: Props) => (
  <VeloxisLayout preview={`IPU signed for application ${dealReference} — funding next`}>
    <Heading style={styles.h1}>Your buyer has signed the IPU</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      <strong>{buyerCompanyName}</strong> has signed the Irrevocable Payment Undertaking for application{' '}
      <strong>{dealReference}</strong>. Veloxis will now disburse your advance shortly.
    </Text>
    <Text style={styles.text}>You'll receive a separate confirmation once the funds have been transferred.</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `IPU signed for application ${data?.dealReference ?? ''} — funding imminent`,
  displayName: 'IPU signed (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    dealReference: 'VLX-2026-0042',
    buyerCompanyName: 'Acme Trading Ltd',
    dealUrl: 'https://app.veloxis.co.uk/exporter/deals/preview',
  },
} satisfies TemplateEntry

export default Email
