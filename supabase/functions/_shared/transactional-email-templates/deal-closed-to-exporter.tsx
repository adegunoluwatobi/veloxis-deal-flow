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
  <VeloxisLayout preview={`Application ${dealReference} closed — thank you`}>
    <Heading style={styles.h1}>Application closed — thank you</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      You've confirmed receipt of your residual for application <strong>{dealReference}</strong> with buyer{' '}
      <strong>{buyerCompanyName}</strong>. The application is now closed.
    </Text>
    <Text style={styles.text}>
      Thank you for working with Veloxis. We look forward to financing your next export.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={dealUrl}>View Application</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Application ${data?.dealReference ?? ''} closed — thank you`,
  displayName: 'Deal closed (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    dealReference: 'VLX-2026-0042',
    buyerCompanyName: 'Acme Trading Ltd',
    dealUrl: 'https://app.veloxis.co.uk/exporter/deals/preview',
  },
} satisfies TemplateEntry

export default Email
