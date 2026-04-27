import { describe, it, expect } from 'vitest';
import { serializePersonsToCsv, type CsvExportRow } from '../../lib/persons/export-csv';

const baseRow: CsvExportRow = {
  id: 'p1',
  givenName: 'Alice',
  surname: 'Smith',
  sex: 'F',
  isLiving: false,
  birthDate: '3 Jan 1903',
  birthPlace: 'Chicago, IL',
  deathDate: '12 Apr 1972',
  deathPlace: 'Boston, MA',
  completeness: 100,
  sourcesCount: 3,
  validation: 'confirmed',
  updatedAt: '2026-04-25T10:00:00.000Z',
};

describe('serializePersonsToCsv', () => {
  it('emits a header row matching the 13 documented columns', () => {
    const csv = serializePersonsToCsv([]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'id,givenName,surname,sex,isLiving,birthDate,birthPlace,deathDate,deathPlace,completeness,sourcesCount,validation,updatedAt',
    );
  });

  it('serializes a normal (non-living) row with all fields populated', () => {
    const csv = serializePersonsToCsv([baseRow]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe(
      'p1,Alice,Smith,F,0,3 Jan 1903,"Chicago, IL",12 Apr 1972,"Boston, MA",100,3,confirmed,2026-04-25T10:00:00.000Z',
    );
  });

  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    const row: CsvExportRow = { ...baseRow, surname: 'O"Brien, Jr.', birthPlace: 'New\nYork' };
    const csv = serializePersonsToCsv([row]);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('"O""Brien, Jr."');
    expect(csv).toContain('"New\nYork"');
  });

  it('masks birth/death info for living persons', () => {
    const row: CsvExportRow = { ...baseRow, isLiving: true };
    const csv = serializePersonsToCsv([row]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe(
      'p1,Alice,Smith,F,1,,,,,100,3,confirmed,2026-04-25T10:00:00.000Z',
    );
  });

  it('handles null/undefined date and place fields gracefully', () => {
    const row: CsvExportRow = {
      ...baseRow,
      birthDate: null,
      birthPlace: null,
      deathDate: null,
      deathPlace: null,
    };
    const csv = serializePersonsToCsv([row]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe(
      'p1,Alice,Smith,F,0,,,,,100,3,confirmed,2026-04-25T10:00:00.000Z',
    );
  });

  it('serializes multiple rows in order', () => {
    const csv = serializePersonsToCsv([
      { ...baseRow, id: 'p1', givenName: 'A' },
      { ...baseRow, id: 'p2', givenName: 'B' },
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(4); // header + 2 rows + trailing newline
    expect(lines[1].startsWith('p1,A,')).toBe(true);
    expect(lines[2].startsWith('p2,B,')).toBe(true);
  });

  it('writes UTF-8 without BOM', () => {
    const csv = serializePersonsToCsv([baseRow]);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
  });
});
