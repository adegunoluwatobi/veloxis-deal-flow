/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from './_layout.tsx'
import { styles } from './_brand.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <VeloxisLayout preview="Your Veloxis sign-in link">
    <Heading style={styles.h1}>Sign in to Veloxis</Heading>
    <Text style={styles.text}>Hi there,</Text>
    <Text style={styles.text}>
      Click the button below to sign in to your Veloxis account. This link will
      expire shortly.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={confirmationUrl}>
        Sign In to Veloxis
      </Button>
    </Section>
    <Text style={styles.muted}>
      If you didn't request this link, you can safely ignore this email.
    </Text>
  </VeloxisLayout>
)

export default MagicLinkEmail
