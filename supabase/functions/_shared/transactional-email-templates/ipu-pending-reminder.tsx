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
  ipuExpiresAt: string
  daysRemaining: number
  signUrl?: string
  dealUrl: string
}

const Email = ({
  exporterContactName,
  dealReference,
  buyerCompanyName,
  ipuExpiresAt,
  daysRemaining,
  signUrl,
  dealUrl,
}: Props) => (
  <VeloxisLayout preview={`IPU pending signature on ${dealReference}`}>
    <Heading style={styles.h1}>Your IPU is awaiting signature</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      The Irrevocable Payment Undertaking (IPU) for application <strong>{dealReference}</strong> with buyer{' '}
      <strong>{buyerCompanyName}</strong> has not yet been signed and will expire on{' '}
      <strong>{ipuExpiresAt}</strong> ({daysRemaining} day{daysRemaining === 1 ? '' : 's'} away).
    </Text>
    <Text style={styles.text}>
      Once the IPU expires, the application returns to the underwriting queue and a new IPU must be issued before
      funds can be disbursed.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={signUrl || dealUrl}>
        {signUrl ? 'Open signing link' : 'View application'}
      </Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Reminder: Sign the IPU for ${data?.dealReference ?? 'your application'} (expires in ${data?.daysRemaining ?? 3} days)`,
  displayName: 'IPU pending — 3 day reminder',
  previewData: {
    exporterContactName: 'Adaeze',
    dealReference: 'VLX-2026-0042',
    buyerCompanyName: 'Acme Trading Ltd',
    ipuExpiresAt: '22 Apr 2026',
    daysRemaining: 3,
    signUrl: 'https://app.hellosign.com/sign/preview',
    dealUrl: 'https://app.veloxis.co.uk/exporter/deals/preview',
  },
} satisfies TemplateEntry

export default Email
