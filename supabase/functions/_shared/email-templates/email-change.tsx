/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from './_layout.tsx'
import { styles } from './_brand.ts'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <VeloxisLayout preview="Confirm your email change for Veloxis">
    <Heading style={styles.h1}>Confirm your email change</Heading>
    <Text style={styles.text}>Hi there,</Text>
    <Text style={styles.text}>
      You requested to change the email address on your Veloxis account from
      <strong> {email}</strong> to <strong>{newEmail}</strong>.
    </Text>
    <Text style={styles.text}>Click the button below to confirm this change.</Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Confirm Email Change
      </Button>
    </Section>
    <Text style={styles.muted}>
      If you didn't request this change, please contact support@veloxis.co.uk
      immediately to secure your account.
    </Text>
  </VeloxisLayout>
)

export default EmailChangeEmail
