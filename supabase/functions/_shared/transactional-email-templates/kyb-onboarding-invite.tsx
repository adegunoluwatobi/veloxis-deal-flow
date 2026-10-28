/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  contactName?: string
  companyName?: string
  inviteUrl: string
  expiresOn?: string
}

const KybOnboardingInviteEmail = ({ contactName, companyName, inviteUrl, expiresOn }: Props) => (
  <VeloxisLayout preview="Your KYB Onboarding Invite from Veloxis">
    <Heading style={styles.h1}>KYB Onboarding Invite</Heading>
    <Text style={styles.text}>Hi {contactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Veloxis Global Limited has invited {companyName?.trim() || 'your company'} to complete
      business onboarding for cross-border trade finance. Use the secure link below to create
      your account and begin.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={inviteUrl}>Create your account</Button>
    </Section>
    <Text style={styles.muted}>
      This link is personal to you{expiresOn ? ` and expires on ${expiresOn}` : ''}. Please do not
      forward it. If you weren't expecting this email, contact support@veloxis.co.uk.
    </Text>
  </VeloxisLayout>
)

export const template = {
  component: KybOnboardingInviteEmail,
  subject: 'Your KYB Onboarding Invite from Veloxis',
  displayName: 'KYB Onboarding Invite',
  previewData: {
    contactName: 'Adaeze',
    companyName: 'Lagos Exports Ltd',
    inviteUrl: 'https://app.veloxis.co.uk/onboard/example',
    expiresOn: '11 Nov 2026',
  },
} satisfies TemplateEntry
