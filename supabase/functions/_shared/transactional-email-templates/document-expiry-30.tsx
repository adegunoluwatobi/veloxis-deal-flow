/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  exporterCompanyName: string
  documentLabel: string
  expiryDate: string
  daysRemaining: number
  uploadUrl: string
}

const Email = ({
  recipientName,
  exporterCompanyName,
  documentLabel,
  expiryDate,
  daysRemaining,
  uploadUrl,
}: Props) => (
  <VeloxisLayout preview={`${documentLabel} expires in ${daysRemaining} days`}>
    <Heading style={styles.h1}>A document is approaching expiry</Heading>
    <Text style={styles.text}>Hi {recipientName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      The <strong>{documentLabel}</strong> on file for <strong>{exporterCompanyName}</strong> will expire on{' '}
      <strong>{expiryDate}</strong> ({daysRemaining} days from today).
    </Text>
    <Text style={styles.text}>
      Please upload a refreshed copy ahead of the expiry date to keep the account in good standing and avoid
      interruptions to active applications.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={uploadUrl}>Upload refreshed document</Button>
    </Section>
    <Text style={styles.muted}>
      If the document has already been replaced, no further action is required.
    </Text>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Action needed: ${data?.documentLabel ?? 'A KYC document'} expires in ${data?.daysRemaining ?? 30} days`,
  displayName: 'Document expiry — 30 day reminder',
  previewData: {
    recipientName: 'Adaeze',
    exporterCompanyName: 'Acme Exports Ltd',
    documentLabel: 'Certificate of Incorporation',
    expiryDate: '19 May 2026',
    daysRemaining: 30,
    uploadUrl: 'https://app.veloxis.co.uk/exporter/documents',
  },
} satisfies TemplateEntry

export default Email
