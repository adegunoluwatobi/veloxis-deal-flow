/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  exporterContactName?: string
  rejectionReason: string
}

const Email = ({ exporterContactName, rejectionReason }: Props) => (
  <VeloxisLayout preview="Update on your Veloxis application">
    <Heading style={styles.h1}>Update on your Veloxis application</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Thank you for your interest in Veloxis. After completing our review, we are
      unable to approve your application at this time.
    </Text>
    <Text style={styles.text}>
      <strong>Reason:</strong>
    </Text>
    <Text style={{ ...styles.text, fontStyle: 'italic' }}>
      "{rejectionReason}"
    </Text>
    <Text style={styles.muted}>
      If you have questions, please contact support@veloxis.co.uk.
    </Text>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: 'Update on your Veloxis application',
  displayName: 'Veloxis rejects exporter (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    rejectionReason: 'Sanctions screening flagged risk indicators that could not be cleared.',
  },
} satisfies TemplateEntry

export default Email
