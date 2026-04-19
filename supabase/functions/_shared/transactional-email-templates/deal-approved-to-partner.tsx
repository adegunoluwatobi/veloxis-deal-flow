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
  invoiceCurrency: string
  invoiceValue: string
  dealUrl: string
}

const Email = ({
  partnerAdminName,
  dealReference,
  exporterCompanyName,
  buyerCompanyName,
  invoiceCurrency,
  invoiceValue,
  dealUrl,
}: Props) => (
  <VeloxisLayout
    preview={`Application ${dealReference} approved for ${exporterCompanyName}`}
  >
    <Heading style={styles.h1}>Application approved by Veloxis</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Application <strong>{dealReference}</strong> for <strong>{exporterCompanyName}</strong> (buyer:{' '}
      {buyerCompanyName}) has been approved by Veloxis.
    </Text>
    <Text style={styles.text}>
      <strong>Invoice value:</strong> {invoiceCurrency} {invoiceValue}
    </Text>
    <Text style={styles.text}>The application now moves to the IPU signature stage.</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Application ${data?.dealReference ?? ''} approved — ${data?.exporterCompanyName ?? ''}`,
  displayName: 'Deal approved (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    dealReference: 'VLX-2026-0042',
    exporterCompanyName: 'Sahara Foods Ltd',
    buyerCompanyName: 'Acme Trading Ltd',
    invoiceCurrency: 'GBP',
    invoiceValue: '125,000',
    dealUrl: 'https://app.veloxis.co.uk/greystar/deals/preview',
  },
} satisfies TemplateEntry

export default Email
