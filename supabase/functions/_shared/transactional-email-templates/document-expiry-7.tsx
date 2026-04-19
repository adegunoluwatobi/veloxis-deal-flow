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
  <VeloxisLayout preview={`Urgent: ${documentLabel} expires in ${daysRemaining} days`}>
    <Heading style={styles.h1}>Urgent — document expires this week</Heading>
    <Text style={styles.text}>Hi {recipientName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      The <strong>{documentLabel}</strong> for <strong>{exporterCompanyName}</strong> expires on{' '}
      <strong>{expiryDate}</strong>, only {daysRemaining} day{daysRemaining === 1 ? '' : 's'} away.
    </Text>
    <Text style={styles.text}>
      Once it expires, the account's KYC standing will be affected and any in-flight applications may be paused
      until a refreshed document is on file.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={uploadUrl}>Upload refreshed document</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Urgent: ${data?.documentLabel ?? 'A KYC document'} expires in ${data?.daysRemaining ?? 7} days`,
  displayName: 'Document expiry — 7 day reminder',
  previewData: {
    recipientName: 'Adaeze',
    exporterCompanyName: 'Acme Exports Ltd',
    documentLabel: 'Certificate of Incorporation',
    expiryDate: '26 Apr 2026',
    daysRemaining: 7,
    uploadUrl: 'https://app.veloxis.co.uk/exporter/documents',
  },
} satisfies TemplateEntry

export default Email
