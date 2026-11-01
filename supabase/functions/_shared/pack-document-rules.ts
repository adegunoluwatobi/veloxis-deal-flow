// One upload-specific presentation omission requested by the application owner.
// This does not clear the security flag or waive onboarding/funding requirements.
export function isPackOmitted(exporterId: string, documentId: string): boolean {
  return exporterId === '0dc60078-67c3-40a5-9414-50e5f5d76749'
    && documentId === 'c0d9a929-c97d-4429-b5da-9ac720675b86';
}

const segment = (value: string) => value.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '') || 'Document';

export function packOriginalName(index: number, label: string, person: string | null, filename: string): string {
  const ext = /\.([A-Za-z0-9]{1,10})$/.exec(filename)?.[1]?.toLowerCase();
  const original = filename.replace(/\.[A-Za-z0-9]{1,10}$/, '');
  return `Documents/${String(index + 1).padStart(2, '0')}_${segment(label)}${person ? `_${segment(person)}` : ''}_${segment(original)}${ext ? `.${ext}` : ''}`;
}