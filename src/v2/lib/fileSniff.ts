/**
 * File type detection by content, never by extension or the browser supplied
 * MIME type. The same signatures are re-checked server side by the
 * `scan-document` edge function before a document becomes readable to reviewers.
 */
export type SniffedType = 'pdf' | 'jpeg' | 'png' | 'webp';

export const TYPE_LABEL: Record<SniffedType, string> = {
  pdf: 'PDF',
  jpeg: 'JPEG image',
  png: 'PNG image',
  webp: 'WEBP image',
};

const CONTENT_TYPE: Record<SniffedType, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const contentTypeFor = (t: SniffedType) => CONTENT_TYPE[t];

function match(b: Uint8Array): SniffedType | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}

/** Reads the leading bytes of the file and returns the real type, or null. */
export async function sniffFileType(file: File): Promise<SniffedType | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return match(head);
}

export const MISMATCH_MESSAGE =
  'This file does not appear to be a PDF, JPEG, PNG or WEBP. Please check the file and try again.';

export const mismatchMessage = (declared: string) =>
  `This file does not appear to be a ${declared}. Please check the file and try again.`;

export const SCAN_PENDING_MESSAGE = 'Checking file, this usually takes a moment.';
