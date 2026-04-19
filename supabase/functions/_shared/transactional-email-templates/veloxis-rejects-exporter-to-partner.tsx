/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  partnerAdminName?: string
  exporterCompanyName: string
  rejectionReason: string
  applicationUrl: string
}

const Email = ({
  partnerAdminName,
  exporterCompanyName,
  rejectionReason,
  applicationUrl,
}: Props) => (
  <VeloxisLayout preview={`${exporterCompanyName} application rejected by Veloxis`}>
    <Heading style={styles.h1}>Exporter application rejected by Veloxis</Heading>
    <Text style={styles.text}>Hi {partnerAdminName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Veloxis has reviewed <strong>{exporterCompanyName}</strong>'s application and was
      unable to approve it at this time.
    </Text>
    <Text style={styles.text}>
      <strong>Reason:</strong>
    </Text>
    <Text style={{ ...styles.text, fontStyle: 'italic' }}>
      "{rejectionReason}"
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={applicationUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `${data?.exporterCompanyName ?? 'An exporter'} application rejected by Veloxis`,
  displayName: 'Veloxis rejects exporter (→ partner)',
  previewData: {
    partnerAdminName: 'Tunde',
    exporterCompanyName: 'Sahara Foods Ltd',
    rejectionReason: 'Sanctions screening flagged risk indicators that could not be cleared.',
    applicationUrl: 'https://app.veloxis.co.uk/greystar/exporters/preview',
  },
} satisfies TemplateEntry

export default Email
