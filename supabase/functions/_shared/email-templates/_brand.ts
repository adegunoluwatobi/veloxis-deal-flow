// Veloxis brand tokens for email templates.
// Keep these in sync with the marketing site / app palette.

export const BRAND = {
  primary: '#0B3D2E', // Deep emerald — header bar
  accent: '#0BA4A4', // Teal — primary CTA
  bodyText: '#1a1a1a',
  mutedText: '#6b7280',
  footerText: '#6b7280',
  footerBg: '#f3f4f6',
  divider: '#e5e7eb',
  white: '#ffffff',
}

export const FONT_STACK =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export const COMPANY = {
  name: 'Veloxis Ltd',
  website: 'veloxis.co.uk',
  address: 'Exeter Business Park, 1 Emperor Way, Exeter, EX1 3QS',
  companyNumber: '15663333',
  supportEmail: 'support@veloxis.co.uk',
}

// Shared style objects
export const styles = {
  main: {
    backgroundColor: '#f3f4f6',
    fontFamily: FONT_STACK,
    margin: 0,
    padding: 0,
  },
  container: {
    backgroundColor: BRAND.white,
    margin: '0 auto',
    maxWidth: '600px',
    padding: 0,
  },
  header: {
    backgroundColor: BRAND.primary,
    padding: '24px 32px',
    textAlign: 'center' as const,
  },
  wordmark: {
    color: BRAND.white,
    fontSize: '22px',
    fontWeight: 700 as const,
    letterSpacing: '0.02em',
    margin: 0,
  },
  body: {
    padding: '32px',
  },
  h1: {
    color: BRAND.bodyText,
    fontSize: '20px',
    fontWeight: 600 as const,
    lineHeight: '28px',
    margin: '0 0 16px',
  },
  text: {
    color: BRAND.bodyText,
    fontSize: '16px',
    lineHeight: '24px',
    margin: '0 0 16px',
  },
  muted: {
    color: BRAND.mutedText,
    fontSize: '14px',
    lineHeight: '20px',
    margin: '0 0 16px',
  },
  buttonWrap: {
    textAlign: 'center' as const,
    padding: '8px 0 24px',
  },
  button: {
    backgroundColor: BRAND.accent,
    color: BRAND.white,
    fontSize: '15px',
    fontWeight: 600 as const,
    borderRadius: '6px',
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  link: {
    color: BRAND.accent,
    textDecoration: 'underline',
  },
  divider: {
    borderTop: `1px solid ${BRAND.divider}`,
    margin: '24px 0',
  },
  footer: {
    backgroundColor: BRAND.footerBg,
    padding: '24px 32px',
    textAlign: 'center' as const,
  },
  footerText: {
    color: BRAND.footerText,
    fontSize: '12px',
    lineHeight: '18px',
    margin: '0 0 4px',
  },
  codeBlock: {
    backgroundColor: '#f3f4f6',
    border: `1px solid ${BRAND.divider}`,
    borderRadius: '6px',
    color: BRAND.bodyText,
    fontFamily: 'Courier, monospace',
    fontSize: '24px',
    fontWeight: 700 as const,
    letterSpacing: '0.2em',
    padding: '16px',
    textAlign: 'center' as const,
    margin: '0 0 24px',
  },
}
