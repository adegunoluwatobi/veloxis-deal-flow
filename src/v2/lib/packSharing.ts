import { z } from 'zod';

export const recipientList = (value: string) => [...new Set(value.split(/[,;\s]+/).map(v => v.trim()).filter(Boolean))];
export const packFormSchema = z.object({
  to: z.array(z.string().email('Enter a valid email address.')).min(1, 'Add at least one recipient.').max(50),
  cc: z.array(z.string().email('Enter a valid CC email address.')).max(50),
  subject: z.string().trim().min(1, 'Enter a subject.').max(255).refine(v => !/[\r\n]/.test(v), 'Enter a single-line subject.'),
  message: z.string().trim().min(1, 'Enter a message.').max(10000),
  pack_type: z.enum(['full', 'summary']),
});

export const activityLabel = (event: string) => ({
  invite_created: 'Invite created', invite_sent: 'Invite sent', invite_resent: 'Invite resent',
  invite_opened: 'Invite opened', invite_registered: 'Registered', invite_revoked: 'Invite revoked',
  application_submitted: 'Application submitted', application_resubmitted: 'Application resubmitted',
  status_changed: 'Status changed', admin_email_changed: 'Admin email change',
  sensitive_field_revealed: 'Sensitive field revealed', kyb_pack_downloaded: 'Pack downloaded',
  kyb_pack_generated: 'Pack generated', shared_pack_downloaded: 'Shared pack downloaded',
  pack_sent: 'Pack sent', pack_link_revoked: 'Pack link revoked', review_approved: 'Review approved', review_returned: 'Returned for correction',
}[event] ?? event.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()));