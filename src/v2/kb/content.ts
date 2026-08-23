export type Audience = 'staff' | 'exporter';

export interface KbArticle {
  id: string;
  title: string;
  summary: string;
  audience: Audience[];
  body: string[];          // paragraphs
  bullets?: string[];      // optional bullet list
}

export interface KbSection {
  id: string;
  title: string;
  description: string;
  articles: KbArticle[];
}

export const ROLE_GUIDE: {
  role: string;
  label: string;
  portal: string;
  purpose: string;
  performs: string[];
  cannot: string[];
}[] = [
  {
    role: 'exporter',
    label: 'Exporter',
    portal: 'Exporter portal (/portal)',
    purpose: 'The customer. A Nigerian exporting company raising finance against confirmed export invoices.',
    performs: [
      'Completes company onboarding: KYB company details and KYC for every director',
      'Uploads the required company documents (CAC, TIN, NEPC, bank statement, board resolution and others)',
      'Adds and maintains buyer records for the overseas customers being invoiced',
      'Submits invoice applications in two stages: commercial details, then supporting trade documents',
      'Responds to information requests and re-uploads returned or expired documents',
      'Uploads the certificate of origin and signs the assignment instruments issued at Stage 2',
      'Tracks application status, maturity dates, disbursement and settlement in the portal',
    ],
    cannot: [
      'See any other exporter, buyer or application',
      'Verify, approve or fund an application',
      'Change fees, limits, FX rates or reference data',
    ],
  },
  {
    role: 'originator',
    label: 'Business Developer',
    portal: 'Staff platform (/app)',
    purpose: 'Owns origination and the client relationship. First line of the review chain.',
    performs: [
      'Invites exporters and guides them through onboarding',
      'Creates and captures applications on behalf of an exporter where needed',
      'Performs first-pass completeness checks on documents and commercial terms',
      'Adds and maintains buyer records and trade references',
      'Chases missing documents and manages the client through the review cycle',
      'Monitors pipeline, ageing and SLA risk on their portfolio',
    ],
    cannot: [
      'Verify documents or complete compliance review',
      'Approve or release funding',
      'Access user management, settings, reference data or retention tools',
    ],
  },
  {
    role: 'credit_officer',
    label: 'Credit & Compliance',
    portal: 'Staff platform (/app)',
    purpose: 'Second line. Verifies identity, documents and credit exposure before an application can reach the approver.',
    performs: [
      'Runs KYB/KYC and AML verification on exporters, directors and buyers',
      'Reviews each uploaded document, accepts or rejects with a reason, and raises information requests',
      'Transcribes the board resolution: authorised limit, currency and signatories',
      'Checks signatory authority and regulated-commodity flags',
      'Pauses and resumes the decision SLA while information is outstanding',
      'Marks the application verified once every gate is satisfied',
    ],
    cannot: [
      'Give the final funding approval on an application they verified (four-eyes rule)',
      'Administer users, settings or system configuration',
    ],
  },
  {
    role: 'approver',
    label: 'Approver (MD)',
    portal: 'Staff platform (/app)',
    purpose: 'Final credit authority. Converts a verified application into an approved, fundable facility.',
    performs: [
      'Reviews the completed verification pack, economics and exposure',
      'Approves, returns for revision, or rejects the application',
      'Confirms the advance amount, fee and maturity date before disbursement',
      'Authorises funding release once all instruments are signed',
      'Oversees monitoring, escalation and settlement outcomes',
    ],
    cannot: [
      'Approve an application where they performed the document verification',
      'Edit reference data, templates or platform settings',
    ],
  },
  {
    role: 'super_admin',
    label: 'Super Admin',
    portal: 'Staff platform (/app) plus all admin tools',
    purpose: 'Platform owner. Full access to every screen, plus configuration and governance tooling.',
    performs: [
      'Creates users, assigns roles and issues magic-link invitations',
      'Manages reference data: commodities, document types, countries, ports and FX rates',
      'Manages document templates and counsel approval of instruments',
      'Configures system settings such as SLA days, fees and e-signature mode',
      'Reviews the audit log, access log, retention schedule and single-reviewer exceptions',
      'Can act in place of any staff role when required, with every action recorded',
    ],
    cannot: [
      'Bypass the audit log — every privileged action is written to an append-only trail',
    ],
  },
];

export const SECTIONS: KbSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'Accounts, sign-in and first steps in the platform.',
    articles: [
      {
        id: 'signing-in',
        title: 'Signing in and first-time password setup',
        summary: 'How invitations, magic links and passwords work.',
        audience: ['staff', 'exporter'],
        body: [
          'Accounts are invite-only. A Super Admin creates the account and the platform emails a magic link. Opening that link signs you in once and takes you straight to the set-password screen.',
          'You must set a password before you can reach any other screen. After that you sign in normally at /login with your email and password. Use "Forgot password" to receive a reset link.',
        ],
        bullets: [
          'Magic links are single-use and expire — request a new one if it fails',
          'Super Admin can see whether an invited user has signed in and set a password',
          'Sign out from the sidebar (staff) or the header (exporter)',
        ],
      },
      {
        id: 'where-am-i',
        title: 'Which portal am I in?',
        summary: 'The platform has two front doors.',
        audience: ['staff', 'exporter'],
        body: [
          'Exporters land in the exporter portal at /portal — a sandboxed view showing only their own company, buyers and applications.',
          'Staff land in the staff platform at /app, with a left sidebar. What appears in that sidebar depends on your role; Super Admin sees everything including the admin tools.',
        ],
      },
    ],
  },
  {
    id: 'roles',
    title: 'Roles and permissions',
    description: 'Who does what, and the controls that separate them.',
    articles: [
      {
        id: 'role-model',
        title: 'The five roles',
        summary: 'Exporter, Business Developer, Credit & Compliance, Approver (MD), Super Admin.',
        audience: ['staff', 'exporter'],
        body: [
          'There are five roles. Exporter is the only customer-facing role; the other four are internal staff roles. A user may hold more than one staff role, but exporter is never combined with a staff role.',
          'See the "Role responsibilities" tab for a full breakdown of what each role performs.',
        ],
      },
      {
        id: 'four-eyes',
        title: 'Segregation of duties (four-eyes)',
        summary: 'The same person cannot verify and approve the same application.',
        audience: ['staff'],
        body: [
          'Every application passes through at least two different people. The staff member who verifies documents on an application is blocked from giving the final funding approval on that same application.',
          'The same rule applies to onboarding: the reviewer who completes one stage cannot complete the conflicting stage. Where an exception is unavoidable it is recorded and surfaced in the Single Reviewer report for Super Admin review.',
        ],
      },
    ],
  },
  {
    id: 'onboarding',
    title: 'Exporter onboarding',
    description: 'KYB, KYC and the documents required before trading.',
    articles: [
      {
        id: 'kyb-kyc',
        title: 'Company (KYB) and director (KYC) profiles',
        summary: 'Both are required before any application can be funded.',
        audience: ['staff', 'exporter'],
        body: [
          'Each exporter is profiled twice: as a company (KYB) and as its people (KYC). Every director must be captured individually with identity details and an accepted ID document.',
          'Onboarding is reviewed by Credit & Compliance. Records move from draft to submitted to verified; a verified exporter can submit applications.',
        ],
        bullets: [
          'CAC certificate and status report',
          'TIN certificate',
          'NEPC exporter certificate',
          'Recent company bank statement',
          'Board resolution authorising the facility',
          'Director ID and proof of address for each director',
        ],
      },
      {
        id: 'board-resolution',
        title: 'Board resolution, limits and signatories',
        summary: 'Defines how much can be drawn and who may sign.',
        audience: ['staff', 'exporter'],
        body: [
          'The board resolution sets the authorised facility limit (held in GBP) and names the people authorised to sign instruments. Credit & Compliance transcribes those details during review.',
          'The platform then enforces them: an application is blocked if the resolution has expired, or if the named signatory is not on the resolution.',
        ],
      },
    ],
  },
  {
    id: 'applications',
    title: 'Applications and the funding lifecycle',
    description: 'From draft invoice to settlement.',
    articles: [
      {
        id: 'two-stage',
        title: 'Two-stage submission',
        summary: 'Commercial details first, then the trade document pack.',
        audience: ['staff', 'exporter'],
        body: [
          'Stage 1 captures the commercial deal: buyer, commodity, incoterm, invoice value and currency, payment terms, shipment and bill of lading dates. Progress autosaves while you work.',
          'Stage 2 is the supporting pack — invoice, bill of lading, packing list, inspection certificate and the rest, depending on the commodity. The application can only be submitted when every required document is present.',
        ],
      },
      {
        id: 'statuses',
        title: 'Application statuses',
        summary: 'What each status means and who acts next.',
        audience: ['staff', 'exporter'],
        body: ['An application moves through a fixed set of states. The status tells you who currently owns it.'],
        bullets: [
          'Draft — with the exporter, not yet submitted',
          'Submitted for Review — awaiting staff review',
          'Information Requested — the exporter must supply something; the SLA clock is paused',
          'Returned for Revision — sent back for correction',
          'Verified — documents and compliance cleared, awaiting the approver',
          'Approved for Funding — credit decision made, instruments to be signed',
          'Funded — advance disbursed',
          'Monitoring — awaiting buyer payment at maturity',
          'Settled — closed and reconciled',
          'Rejected / Defaulted — terminal outcomes',
        ],
      },
      {
        id: 'economics',
        title: 'Advance, fees and maturity',
        summary: 'How the numbers are calculated.',
        audience: ['staff', 'exporter'],
        body: [
          'The advance is a percentage of the invoice value, with the fee derived from the payment terms — 30 days 3.5%, 45 days 4.5%, 60 days 5.5%.',
          'The maturity date is derived from the bill of lading date plus the payment terms. Once an application reaches submitted, the maturity date is frozen; only a staff override can change it, and that override is audited.',
        ],
      },
      {
        id: 'sla',
        title: 'Decision SLA and escalation',
        summary: 'Working-day clocks in Africa/Lagos time.',
        audience: ['staff'],
        body: [
          'Each submitted application gets a decision deadline measured in working days, skipping weekends and seeded Nigerian public holidays. All business date logic runs in Africa/Lagos time.',
          'Raising an information request pauses the clock; resolving it resumes. A nightly job advances the escalation ladder on ageing items and flags applications at risk of breaching SLA.',
        ],
      },
    ],
  },
  {
    id: 'documents',
    title: 'Documents',
    description: 'Uploads, review, requests and security.',
    articles: [
      {
        id: 'uploads',
        title: 'Uploading and replacing documents',
        summary: 'Versioned, scanned and never destructively overwritten.',
        audience: ['staff', 'exporter'],
        body: [
          'Uploading a replacement supersedes the previous file rather than deleting it, so the full version history stays intact for audit.',
          'Every file is checked by content, not just file extension, and is held in a quarantine state until the scan completes. Staff cannot open a document until it is marked clean.',
        ],
        bullets: [
          'Accepted formats: PDF, JPEG, PNG, WEBP',
          'Documents with an expiry date must have that date recorded',
          'All views are served through short-lived signed links and are access-logged',
        ],
      },
      {
        id: 'review',
        title: 'Document review and information requests',
        summary: 'How staff accept, reject and chase documents.',
        audience: ['staff'],
        body: [
          'Documents are grouped by category in the review panel with inline PDF and image preview. Each item is accepted or rejected with a reason.',
          'Rejecting one or more items raises an information request: the application moves to Information Requested, the exporter is notified, and the SLA pauses until the items are resolved or the request is withdrawn.',
        ],
      },
      {
        id: 'instruments',
        title: 'Stage 2 instruments and e-signature',
        summary: 'Veloxis generates them; the exporter signs.',
        audience: ['staff', 'exporter'],
        body: [
          'Once approved, the platform generates the assignment instruments from counsel-approved templates and routes them for electronic signature. The exporter also uploads the certificate of origin.',
          'Funding stays locked until the signature webhook confirms every instrument is executed and the certificate of origin is verified.',
        ],
      },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    description: 'Super Admin tooling.',
    articles: [
      {
        id: 'users',
        title: 'User management',
        summary: 'Creating accounts and assigning roles.',
        audience: ['staff'],
        body: [
          'Super Admin creates users, assigns one or more staff roles, and sends magic-link invitations. The directory shows whether each invitee has signed in and set a password.',
          'A user may hold additional staff roles, but the exporter role is exclusive and always tied to a single exporter company.',
        ],
      },
      {
        id: 'reference-data',
        title: 'Reference data and FX',
        summary: 'Commodities, document types, countries, ports and rates.',
        audience: ['staff'],
        body: [
          'Reference data drives the dropdowns across the platform. FX rates are managed on their own tab; a rate flagged as a placeholder cannot be used to stamp an application, which blocks submission until a real rate is captured.',
        ],
      },
      {
        id: 'audit',
        title: 'Audit, access log and retention',
        summary: 'Everything is recorded and nothing is silently lost.',
        audience: ['staff'],
        body: [
          'The audit trail is append-only — records cannot be updated or deleted, and a failed audit write aborts the whole transaction rather than letting an unlogged change through.',
          'The access log records every document view. The retention screen shows what is scheduled for archive or deletion and when.',
        ],
      },
      {
        id: 'notifications',
        title: 'Notifications and delivery',
        summary: 'Templated emails with retry.',
        audience: ['staff'],
        body: [
          'Transactional emails are generated from managed templates and queued for delivery. Failed sends retry with backoff, and anything still undelivered appears on the Undelivered screen for follow-up.',
        ],
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Common issues and what to do.',
    articles: [
      {
        id: 'cant-submit',
        title: 'I cannot submit my application',
        summary: 'Usually a gate rather than a bug.',
        audience: ['staff', 'exporter'],
        body: ['Submission is blocked until every gate passes. Check each of the following.'],
        bullets: [
          'Onboarding is verified and all company documents are accepted',
          'A valid, in-date board resolution is on file',
          'The signatory named on the application appears on the board resolution',
          'Every required document for the commodity has been uploaded',
          'A live (non-placeholder) FX rate exists for the invoice currency',
        ],
      },
      {
        id: 'blank-page',
        title: 'The portal looks empty after signing in',
        summary: 'Onboarding has not been started.',
        audience: ['exporter'],
        body: [
          'A brand-new exporter account has no data yet. Open My Company and complete onboarding; the dashboard fills in as records are created.',
        ],
      },
      {
        id: 'no-access',
        title: 'A screen is missing from my sidebar',
        summary: 'Role gating, not an error.',
        audience: ['staff'],
        body: [
          'Admin screens such as User Management, Settings, Reference Data, Templates, Access Log and Retention are Super Admin only. If you need access, ask a Super Admin to grant the role.',
        ],
      },
    ],
  },
];
