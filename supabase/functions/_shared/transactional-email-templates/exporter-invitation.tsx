/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  firstName?: string
  partnerOrganisationName?: string
  acceptUrl: string
}

const ExporterInvitationEmail = ({ firstName, partnerOrganisationName, acceptUrl }: Props) => (
  <VeloxisLayout preview="You've been invited to join Veloxis">
    <Heading style={styles.h1}>You've been invited to join Veloxis</Heading>
    <Text style={styles.text}>Hi {firstName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      {partnerOrganisationName?.trim() || 'Your partner organisation'} has invited you to
      join the Veloxis trade finance platform to begin your onboarding.
    </Text>
    <Text style={styles.text}>
      Click below to accept your invitation and set up your account.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={acceptUrl}>
        Accept Invitation &amp; Get Started
      </Button>
    </Section>
    <Text style={styles.muted}>
      This link expires in 48 hours. If you were not expecting this invitation, please
      ignore this email or contact support@veloxis.co.uk.
    </Text>
  </VeloxisLayout>
)

export const template = {
  component: ExporterInvitationEmail,
  subject: "You've been invited to join Veloxis",
  displayName: 'Exporter invitation',
  previewData: {
    firstName: 'Adaeze',
    partnerOrganisationName: 'Greystar Capital',
    acceptUrl: 'https://app.veloxis.co.uk/set-password?token=preview',
  },
} satisfies TemplateEntry

export default ExporterInvitationEmail
