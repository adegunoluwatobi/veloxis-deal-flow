/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  exporterCompanyName: string
  partnerOrganisationName: string
  country?: string
  commodity?: string
  submittedDate?: string
  adminUrl: string
}

const Email = ({
  exporterCompanyName,
  partnerOrganisationName,
  country,
  commodity,
  submittedDate,
  adminUrl,
}: Props) => (
  <VeloxisLayout preview={`New exporter ready for Veloxis review — ${exporterCompanyName}`}>
    <Heading style={styles.h1}>New exporter ready for Veloxis review</Heading>
    <Text style={styles.text}>
      A new exporter application has been approved by a partner and is ready for
      Veloxis final review.
    </Text>
    <Text style={styles.text}>
      <strong>Exporter:</strong> {exporterCompanyName}
      <br />
      <strong>Partner:</strong> {partnerOrganisationName}
      <br />
      <strong>Country:</strong> {country?.trim() || '—'}
      <br />
      <strong>Commodity:</strong> {commodity?.trim() || '—'}
      <br />
      <strong>Submitted:</strong> {submittedDate?.trim() || '—'}
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={adminUrl}>Review in Admin Panel</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `New exporter ready for Veloxis review — ${data?.exporterCompanyName ?? 'unknown'}`,
  displayName: 'Partner forwards to Veloxis (→ admin)',
  previewData: {
    exporterCompanyName: 'Sahara Foods Ltd',
    partnerOrganisationName: 'Greystar Capital',
    country: 'Nigeria',
    commodity: 'Cashew nuts',
    submittedDate: '15 Apr 2026',
    adminUrl: 'https://app.veloxis.co.uk/admin/applications',
  },
} satisfies TemplateEntry

export default Email
