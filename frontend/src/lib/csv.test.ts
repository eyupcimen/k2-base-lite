import { describe, expect, it } from 'vitest';
import { bomToCsv } from './csv';

describe('bomToCsv', () => {
  it('writes header and rows', () => {
    const csv = bomToCsv([{ item_number: 'EXAMPLE-001', description: 'Rail 4.40 m', quantity: 4, unit: 'Pcs' }]);
    expect(csv).toBe('item_number,description,quantity,unit\nEXAMPLE-001,Rail 4.40 m,4,Pcs\n');
  });
  it('escapes commas and quotes', () => {
    const csv = bomToCsv([{ item_number: 'EXAMPLE-002', description: 'Clamp, "mid"', quantity: 1, unit: 'Set' }]);
    expect(csv.split('\n')[1]).toBe('EXAMPLE-002,"Clamp, ""mid""",1,Set');
  });
});
