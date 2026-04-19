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
  <VeloxisLayout preview={`${exporterCompanyName} has submitted their onboarding form`}>
    <Heading style={styles.h1}>Onboarding form submitted</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      <strong>{exporterCompanyName}</strong> has submitted their onboarding form and is
      now awaiting document upload.
    </Text>
    <Text style={styles.text}>Log in to your dashboard to review their progress.</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={applicationUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `${data?.exporterCompanyName ?? 'An exporter'} has submitted their onboarding form`,
  displayName: 'Onboarding form submitted (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    exporterCompanyName: 'Sahara Foods Ltd',
    applicationUrl: 'https://app.veloxis.co.uk/greystar/exporters/preview',
  },
} satisfies TemplateEntry

export default Email
