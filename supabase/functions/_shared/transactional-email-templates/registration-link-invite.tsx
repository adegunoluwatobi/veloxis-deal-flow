/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  fullName?: string
  registrationUrl: string
}

const RegistrationLinkInviteEmail = ({ fullName, registrationUrl }: Props) => (
  <VeloxisLayout preview="You've been invited to apply on Veloxis">
    <Heading style={styles.h1}>Start your Veloxis application</Heading>
    <Text style={styles.text}>Hi {fullName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      Veloxis has invited you to apply for trade finance through our platform.
      Click the button below to begin your registration. You'll be guided through
      a short application and notified once it has been reviewed.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={registrationUrl}>
        Start Application
      </Button>
    </Section>
    <Text style={styles.muted}>
      If you weren't expecting this email, you can safely ignore it. For questions,
      contact support@veloxis.co.uk.
    </Text>
  </VeloxisLayout>
)

export const template = {
  component: RegistrationLinkInviteEmail,
  subject: "You've been invited to apply on Veloxis",
  displayName: 'Registration link invite',
  previewData: {
    fullName: 'Adaeze',
    registrationUrl: 'https://app.veloxis.co.uk/apply/exporter',
  },
} satisfies TemplateEntry

export default RegistrationLinkInviteEmail
