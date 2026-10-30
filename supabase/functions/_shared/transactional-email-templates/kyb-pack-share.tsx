import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import { BRAND, FONT_STACK, styles } from '../email-templates/_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props { companyName?: string; subject?: string; message?: string; downloadUrl?: string; expiresOn?: string; packType?: string }
const Email = ({ companyName = 'Exporter', message = 'Please review the exporter KYB pack.', downloadUrl, expiresOn, packType }: Props) => (
  <Html lang="en"><Head /><Preview>Secure KYB pack for {companyName}</Preview>
    <Body style={{ backgroundColor: BRAND.white, fontFamily: FONT_STACK }}>
      <Container style={{ ...styles.container, padding: '32px' }}>
        <Text style={{ color: BRAND.primary, fontWeight: 700 }}>VELOXIS</Text>
        <Heading style={styles.h1}>{companyName} · KYB pack</Heading>
        <Text style={{ ...styles.text, whiteSpace: 'pre-line' }}>{message}</Text>
        {downloadUrl && <Button style={styles.button} href={downloadUrl}>{packType === 'summary' ? 'Download KYB summary' : 'Download full KYB pack'}</Button>}
        <Text style={{ ...styles.muted, marginTop: '24px' }}>This secure link expires on {expiresOn || 'the stated expiry date'} (7 days) and may be revoked earlier by Veloxis.</Text>
        <Text style={styles.muted}>Strictly Private &amp; Confidential</Text>
      </Container>
    </Body>
  </Html>
)
export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) => String(data.subject || `Exporter KYB Pack: ${data.companyName || 'Exporter'}`),
  displayName: 'Secure exporter KYB pack',
  previewData: { companyName: 'Example Exporter', message: 'Please review the exporter KYB pack.', expiresOn: '6 November 2026, 12:00 UTC' },
} satisfies TemplateEntry