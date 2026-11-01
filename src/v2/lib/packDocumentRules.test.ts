import { describe, expect, it } from 'vitest';
import { isPackOmitted, packOriginalName } from '../../../supabase/functions/_shared/pack-document-rules';

const mike = '0dc60078-67c3-40a5-9414-50e5f5d76749';
const statement = 'c0d9a929-c97d-4429-b5da-9ac720675b86';

describe('upload-specific pack omission', () => {
  it('omits only Mike’s specified bank statement', () => {
    expect(isPackOmitted(mike, statement)).toBe(true);
  });
  it('does not apply to another exporter', () => {
    expect(isPackOmitted('another-exporter', statement)).toBe(false);
  });
  it('does not omit Mike’s replacement statement or director ID', () => {
    expect(isPackOmitted(mike, 'replacement-statement')).toBe(false);
    expect(isPackOmitted(mike, 'c70b1a04-b92c-442a-aa60-0a6a8a63e740')).toBe(false);
  });
});

describe('labelled ZIP originals', () => {
  it('labels director ID files with type, person and original name', () => {
    expect(packOriginalName(0, 'Director government ID', 'Akinyomi Michael', 'NIN slip.pdf'))
      .toBe('Documents/01_Director_government_ID_Akinyomi_Michael_NIN_slip.pdf');
  });
  it('uses unique numbered filenames even for duplicate uploads', () => {
    expect(packOriginalName(0, 'CAC certificate', null, 'CAC.pdf'))
      .not.toBe(packOriginalName(1, 'CAC certificate', null, 'CAC.pdf'));
  });
  it('removes path traversal from source names and labels', () => {
    expect(packOriginalName(0, '../ID', '../../Person', '../../slip.PDF'))
      .toBe('Documents/01_ID_Person_slip.pdf');
  });
});