export interface CsvExportRow {
  id: string;
  givenName: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
  isLiving: boolean;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  completeness: number;
  sourcesCount: number;
  validation: 'confirmed' | 'proposed';
  updatedAt: string;
}

const HEADERS: readonly (keyof CsvExportRow)[] = [
  'id', 'givenName', 'surname', 'sex', 'isLiving',
  'birthDate', 'birthPlace', 'deathDate', 'deathPlace',
  'completeness', 'sourcesCount', 'validation', 'updatedAt',
];

function escape(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize export rows to RFC-4180 CSV (UTF-8 no BOM).
 *
 * Living-person rows have birth/death fields blanked; name + sex remain.
 */
export function serializePersonsToCsv(rows: readonly CsvExportRow[]): string {
  const lines: string[] = [HEADERS.join(',')];

  for (const row of rows) {
    const masked = row.isLiving
      ? { ...row, birthDate: null, birthPlace: null, deathDate: null, deathPlace: null }
      : row;
    lines.push(HEADERS.map((h) => escape(masked[h])).join(','));
  }

  return lines.join('\n') + '\n';
}
