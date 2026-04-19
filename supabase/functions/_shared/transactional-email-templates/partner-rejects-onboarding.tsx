/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  exporterContactName?: string
  partnerOrganisationName: string
  rejectionReason: string
}

const Email = ({ exporterContactName, partnerOrganisationName, rejectionReason }: Props) => (
  <VeloxisLayout preview="Update on your Veloxis onboarding application">
    <Heading style={styles.h1}>Update on your onboarding application</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Thank you for submitting your onboarding application. After review,{' '}
      <strong>{partnerOrganisationName}</strong> was unable to approve your application
      at this time.
    </Text>
    <Text style={styles.text}>
      <strong>Reason provided:</strong>
    </Text>
    <Text style={{ ...styles.text, fontStyle: 'italic' }}>
      "{rejectionReason}"
    </Text>
    <Text style={styles.muted}>
      If you believe this is an error or have questions, please contact
      support@veloxis.co.uk.
    </Text>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: 'Update on your Veloxis onboarding application',
  displayName: 'Partner rejects onboarding (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    partnerOrganisationName: 'Greystar Capital',
    rejectionReason: 'Source of funds documentation does not meet our compliance requirements.',
  },
} satisfies TemplateEntry

export default Email
