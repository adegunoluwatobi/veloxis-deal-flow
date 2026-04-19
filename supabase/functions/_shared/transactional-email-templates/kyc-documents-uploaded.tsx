/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  partnerAdminName?: string
  exporterCompanyName: string
  applicationUrl: string
}

const Email = ({ partnerAdminName, exporterCompanyName, applicationUrl }: Props) => (
  <VeloxisLayout
    preview={`${exporterCompanyName} has uploaded their KYC documents — ready for review`}
  >
    <Heading style={styles.h1}>KYC documents uploaded — ready for review</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      <strong>{exporterCompanyName}</strong> has uploaded all required KYC documents.
      Their application is now ready for your review.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={applicationUrl}>Review Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `${data?.exporterCompanyName ?? 'An exporter'} has uploaded their KYC documents — ready for review`,
  displayName: 'KYC documents uploaded (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    exporterCompanyName: 'Sahara Foods Ltd',
    applicationUrl: 'https://app.veloxis.co.uk/greystar/exporters/preview',
  },
} satisfies TemplateEntry

export default Email
