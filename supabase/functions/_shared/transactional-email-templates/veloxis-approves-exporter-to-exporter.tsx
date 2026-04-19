/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Heading, Section, Text } from 'npm:@react-email/components@0.0.22'
import { VeloxisLayout } from '../email-templates/_layout.tsx'
import { styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  exporterContactName?: string
  loginUrl: string
}

const Email = ({ exporterContactName, loginUrl }: Props) => (
  <VeloxisLayout preview="Welcome to Veloxis — your account is active">
    <Heading style={styles.h1}>Welcome to Veloxis — your account is active</Heading>
    <Text style={styles.text}>Hi {exporterContactName?.trim() || 'there'},</Text>
    <Text style={styles.text}>
      We are pleased to confirm that your onboarding has been approved by the Veloxis
      team. Your account is now fully active.
    </Text>
    <Text style={styles.text}>
      You can now log in and submit your first trade finance application.
    </Text>
    <Section style={styles.buttonWrap}>
      <Button style={styles.button} href={loginUrl}>Log In to Veloxis</Button>
    </Section>
  </VeloxisLayout>
)

export const template = {
  component: Email,
  subject: 'Welcome to Veloxis — your account is active',
  displayName: 'Veloxis approves exporter (→ exporter)',
  previewData: {
    exporterContactName: 'Adaeze',
    loginUrl: 'https://app.veloxis.co.uk/login',
  },
} satisfies TemplateEntry

export default Email
