/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from './_layout.tsx'
import { styles } from './_brand.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <VeloxisLayout preview="You've been invited to join Veloxis">
    <Heading style={styles.h1}>You've been invited to Veloxis</Heading>
    <Text style={styles.text}>Hi there,</Text>
    <Text style={styles.text}>
      You've been invited to join the Veloxis trade finance platform. Click the
      button below to accept your invitation and set up your account.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Accept Invitation & Get Started
      </Button>
    </Section>
    <Text style={styles.muted}>
      This link expires in 48 hours. If you weren't expecting this invitation,
      you can safely ignore this email.
    </Text>
  </VeloxisLayout>
)

export default InviteEmail
