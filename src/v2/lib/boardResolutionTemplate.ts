/**
 * Generates a printable board resolution template pre-filled with the exporter's
 * company details. It includes an authorised signature specimen block capturing
 * name, designation, company email and a wet-signature box.
 */
export type ResolutionTemplateInput = {
  companyName?: string | null;
  registrationNumber?: string | null;
  registeredAddress?: string | null;
  companyEmail?: string | null;
  signatories?: { name?: string | null; designation?: string | null; email?: string | null }[];
};

const esc = (v?: string | null) =>
  String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function boardResolutionHtml(i: ResolutionTemplateInput) {
  const line = (v?: string | null) =>
    v ? esc(v) : '<span style="display:inline-block;min-width:220px;border-bottom:1px solid #999">&nbsp;</span>';

  const rows = (i.signatories?.length ? i.signatories : [{}, {}])
    .map(
      (s) => `
      <tr>
        <td>${line(s.name)}</td>
        <td>${line(s.designation)}</td>
        <td>${line(s.email ?? i.companyEmail)}</td>
        <td style="height:70px"></td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Board Resolution — ${esc(i.companyName)}</title>
<style>
  @page { size: A4; margin: 22mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color:#111; line-height:1.6; font-size:12.5pt; }
  h1 { font-size:16pt; text-align:center; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }
  .sub { text-align:center; font-size:11pt; color:#444; margin-bottom:28px; }
  table { width:100%; border-collapse:collapse; margin-top:10px; font-size:11pt; }
  th, td { border:1px solid #999; padding:8px 10px; text-align:left; vertical-align:top; }
  th { background:#f2f2f2; font-size:10pt; text-transform:uppercase; letter-spacing:.04em; }
  ol { padding-left:20px; } li { margin-bottom:10px; }
  .meta p { margin:2px 0; }
  .note { font-size:10pt; color:#555; margin-top:26px; }
</style></head>
<body>

  <h1>${line(i.companyName)}</h1>
  <div class="sub">Extract of resolution of the Board of Directors</div>

  <div class="meta">
    <p><strong>Company name:</strong> ${line(i.companyName)}</p>
    <p><strong>RC / registration number:</strong> ${line(i.registrationNumber)}</p>
    <p><strong>Registered address:</strong> ${line(i.registeredAddress)}</p>
    <p><strong>Company email:</strong> ${line(i.companyEmail)}</p>
    <p><strong>Date of meeting:</strong> ${line(null)}</p>
  </div>

  <p style="margin-top:22px"><strong>IT WAS RESOLVED THAT:</strong></p>
  <ol>
    <li>The Company be and is hereby authorised to enter into cross-border trade finance
        arrangements with Veloxis Limited, including the assignment of export receivables.</li>
    <li>The maximum aggregate limit authorised under these arrangements shall be
        <strong>GBP ${line(null)}</strong> (in words: ${line(null)}), measured on invoice face value.</li>
    <li>This authority shall be valid from ${line(null)} until ${line(null)}.</li>
    <li>The persons named below be and are hereby appointed authorised signatories, each empowered
        to execute invoices, deeds of assignment, notices of assignment, domiciliation instructions
        and all related documents on behalf of the Company.</li>
    <li>Settlement of all sums due to the Company shall be made only to the corporate domiciliary
        account notified to Veloxis Limited.</li>
  </ol>

  <p style="margin-top:20px"><strong>Authorised signatories and signature specimens</strong></p>
  <table>
    <thead><tr><th>Full name</th><th>Designation</th><th>Company email</th><th>Signature specimen</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table style="margin-top:26px">
    <thead><tr><th>Signed for and on behalf of the Board</th><th>Company Secretary / Director</th></tr></thead>
    <tbody><tr><td style="height:90px">Name: ${line(null)}<br/>Designation: ${line(null)}</td>
    <td style="height:90px">Name: ${line(null)}<br/>Designation: ${line(null)}</td></tr></tbody>
  </table>

  <p class="note">Print this template on company letterhead, complete every field, sign, then upload the
  scanned copy as your board resolution.</p>
</body></html>`;
}

export function openBoardResolutionTemplate(input: ResolutionTemplateInput) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(boardResolutionHtml(input));
  w.document.close();
  return true;
}
