/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from './_layout.tsx'
import { styles } from './_brand.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <VeloxisLayout preview="Confirm your Veloxis account">
    <Heading style={styles.h1}>Confirm your email</Heading>
    <Text style={styles.text}>Hi there,</Text>
    <Text style={styles.text}>
      Thanks for joining Veloxis. Please confirm your email address ({recipient})
      by clicking the button below.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Confirm Email Address
      </Button>
    </Section>
    <Text style={styles.muted}>
      If you didn't create a Veloxis account, you can safely ignore this email.
    </Text>
  </VeloxisLayout>
)

export default SignupEmail
