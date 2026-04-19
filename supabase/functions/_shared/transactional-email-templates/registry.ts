/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

// Veloxis transactional email templates.
// Stage 1 (onboarding emails 1–9) will be added here.
export const TEMPLATES: Record<string, TemplateEntry> = {}
