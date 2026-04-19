/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from './_layout.tsx'
import { styles } from './_brand.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <VeloxisLayout preview="Your Veloxis verification code">
    <Heading style={styles.h1}>Confirm your identity</Heading>
    <Text style={styles.text}>Hi there,</Text>
    <Text style={styles.text}>
      Use the verification code below to confirm your identity on Veloxis.
    </Text>
    <Text style={styles.codeBlock}>{token}</Text>
    <Text style={styles.muted}>
      This code will expire shortly. If you didn't request this, you can safely
      ignore this email.
    </Text>
  </VeloxisLayout>
)

export default ReauthenticationEmail
