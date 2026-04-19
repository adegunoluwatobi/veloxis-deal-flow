/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { COMPANY, styles } from './_brand.ts'

interface VeloxisLayoutProps {
  preview: string
  children: React.ReactNode
}

export const VeloxisLayout = ({ preview, children }: VeloxisLayoutProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.wordmark}>VELOXIS</Text>
        </Section>
        <Section style={styles.body}>{children}</Section>
        <Section style={styles.footer}>
          <Text style={styles.footerText}>
            <strong>{COMPANY.name}</strong> | {COMPANY.website}
          </Text>
          <Text style={styles.footerText}>{COMPANY.address}</Text>
          <Text style={styles.footerText}>
            Company number: {COMPANY.companyNumber}
          </Text>
          <Text style={{ ...styles.footerText, marginTop: '8px' }}>
            You received this email because you have an account on the Veloxis
            platform.
          </Text>
          <Text style={styles.footerText}>
            Questions? Contact {COMPANY.supportEmail}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)
