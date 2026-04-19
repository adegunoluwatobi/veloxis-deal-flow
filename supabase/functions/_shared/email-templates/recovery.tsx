/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from './_layout.tsx'
import { styles } from './_brand.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <VeloxisLayout preview="Reset your Veloxis password">
    <Heading style={styles.h1}>Reset your Veloxis password</Heading>
    <Text style={styles.text}>Hi there,</Text>
    <Text style={styles.text}>
      We received a request to reset the password for your Veloxis account.
      Click the button below to set a new password. This link expires in 1 hour.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Reset My Password
      </Button>
    </Section>
    <Text style={styles.muted}>
      If you did not request a password reset, you can safely ignore this email.
      Your password will not change.
    </Text>
  </VeloxisLayout>
)

export default RecoveryEmail
