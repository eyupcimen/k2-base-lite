import type { BomItem } from './api';

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function bomToCsv(bom: BomItem[]): string {
  const header = ['item_number', 'description', 'quantity', 'unit'];
  return [header.join(','), ...bom.map((b) => [b.item_number, b.description, b.quantity, b.unit].map(esc).join(','))].join('\n') + '\n';
}

export function downloadCsv(bom: BomItem[], filename = 'k2-base-lite-bom.csv') {
  const url = URL.createObjectURL(new Blob([bomToCsv(bom)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
