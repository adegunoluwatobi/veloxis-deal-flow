import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import { BRAND, FONT_STACK, styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  companyName?: string
  recipientName?: string
  applicationUrl?: string
  resubmitted?: boolean
}

const Email = ({ companyName = 'An exporter', recipientName, applicationUrl, resubmitted = false }: Props) => (
  <Html lang="en"><Head /><Preview>{companyName} is ready for onboarding review</Preview>
    <Body style={{ backgroundColor: BRAND.white, fontFamily: FONT_STACK }}>
      <Container style={{ ...styles.container, padding: '32px' }}>
        <Text style={{ color: BRAND.primary, fontWeight: 700 }}>VELOXIS</Text>
        <Heading style={styles.h1}>Application {resubmitted ? 'resubmitted' : 'submitted'}</Heading>
        <Text style={styles.text}>Hi {recipientName || 'there'},</Text>
        <Text style={styles.text}>{companyName} has {resubmitted ? 'resubmitted' : 'submitted'} their onboarding application and it is ready for review.</Text>
        <Button style={styles.button} href={applicationUrl || 'https://app.veloxis.co.uk/app/exporters'}>Review application</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) => `${data.companyName || 'Exporter'}: onboarding ${data.resubmitted ? 'resubmitted' : 'submitted'}`,
  displayName: 'Exporter application ready for review',
  previewData: { companyName: 'Example Exporter', recipientName: 'Reviewer', applicationUrl: 'https://app.veloxis.co.uk/app/exporters' },
} satisfies TemplateEntry