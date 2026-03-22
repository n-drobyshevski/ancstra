# GEDCOM Import/Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import GEDCOM 5.5.1 files into the Ancstra database via a two-step wizard (preview → commit), and export tree data as GEDCOM with privacy filtering.

**Architecture:** `parse-gedcom` library parses GEDCOM text into an AST. Custom mapper transforms AST → our DB schema types. Server actions handle preview (no writes) and commit (transactional insert). Serializer reverses the process for export. All logic is pure functions tested with Vitest.

**Tech Stack:** parse-gedcom, Next.js 16 server actions, Drizzle ORM, better-sqlite3, Vitest, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-22-gedcom-import-export-design.md`

---

## File Structure

All paths relative to project root (`D:/projects/ancstra/`).

```
apps/web/
  lib/gedcom/
    parse.ts              — Encoding detection + parse-gedcom wrapper
    mapper.ts             — AST → GedcomImportData (names, dates, events, warnings)
    serialize.ts          — DB data → GEDCOM 5.5.1 string
    types.ts              — GedcomImportData interface + related types

  app/actions/
    import-gedcom.ts      — Server action: previewGedcom + commitGedcomImport
    export-gedcom.ts      — Server action: exportGedcom (fetch + serialize + download)

  app/(auth)/
    import/page.tsx       — Import page with GedcomImport component
    export/page.tsx       — Export page with mode selector + download

  components/
    gedcom-import.tsx     — Client component: upload + preview + confirm wizard

  __tests__/
    gedcom/mapper.test.ts     — Unit tests for GEDCOM→DB mapping
    gedcom/serialize.test.ts  — Unit tests for DB→GEDCOM serialization
```

---

## Task 0: Install parse-gedcom + Create Types

**Files:**
- Create: `apps/web/lib/gedcom/types.ts`

- [ ] **Step 1: Install parse-gedcom**

```bash
cd D:/projects/ancstra/apps/web && pnpm add parse-gedcom
```

- [ ] **Step 2: Create apps/web/lib/gedcom/types.ts**

```typescript
// GEDCOM AST node from parse-gedcom
export interface GedcomNode {
  tag: string;
  data: string;
  tree: GedcomNode[];
}

// Parsed import data ready for DB insertion
export interface GedcomImportData {
  persons: GedcomPerson[];
  names: GedcomName[];
  families: GedcomFamily[];
  childLinks: GedcomChildLink[];
  events: GedcomEvent[];
  warnings: GedcomWarning[];
  stats: GedcomStats;
}

export interface GedcomPerson {
  id: string;
  sex: 'M' | 'F' | 'U';
  isLiving: boolean;
  notes: string | null;
  xref: string;
}

export interface GedcomName {
  id: string;
  personId: string;
  givenName: string;
  surname: string;
  suffix: string | null;
  prefix: string | null;
  nameType: string;
  isPrimary: boolean;
}

export interface GedcomFamily {
  id: string;
  partner1Id: string | null;
  partner2Id: string | null;
  xref: string;
}

export interface GedcomChildLink {
  familyId: string;
  personId: string;
}

export interface GedcomEvent {
  id: string;
  eventType: string;
  dateOriginal: string | null;
  dateSort: number | null;
  dateModifier: string | null;
  dateEndSort: number | null;
  placeText: string | null;
  personId: string | null;
  familyId: string | null;
}

export interface GedcomWarning {
  type: 'error' | 'warning' | 'info';
  message: string;
  xref?: string;
}

export interface GedcomStats {
  persons: number;
  families: number;
  events: number;
  skippedSources: number;
}

// Preview result returned to the UI
export interface GedcomPreview {
  stats: GedcomStats;
  warnings: GedcomWarning[];
  existingPersonCount: number;
}
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/lib/gedcom/types.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(gedcom): install parse-gedcom + import/export type definitions"
```

---

## Task 1: GEDCOM Parser (Encoding + parse-gedcom Wrapper)

**Files:**
- Create: `apps/web/lib/gedcom/parse.ts`

- [ ] **Step 1: Create apps/web/lib/gedcom/parse.ts**

```typescript
import parseGedcom from 'parse-gedcom';
import type { GedcomNode } from './types';

/**
 * Detect encoding from GEDCOM CHAR tag in the raw bytes.
 * Reads first 500 bytes as ASCII to find "1 CHAR <value>".
 */
function detectEncoding(buffer: ArrayBuffer): string {
  const preview = new TextDecoder('ascii').decode(buffer.slice(0, 500));
  const charMatch = preview.match(/1\s+CHAR\s+(\S+)/i);
  if (!charMatch) return 'utf-8';

  const charset = charMatch[1].toUpperCase();
  if (charset === 'ANSI' || charset === 'ASCII') return 'windows-1252';
  if (charset === 'UNICODE') return 'utf-16le';
  return 'utf-8';
}

/**
 * Parse a GEDCOM file (ArrayBuffer) into an AST.
 * Handles encoding detection automatically.
 */
export function parseGedcomFile(buffer: ArrayBuffer): GedcomNode[] {
  const encoding = detectEncoding(buffer);
  const text = new TextDecoder(encoding).decode(buffer);

  // parse-gedcom returns an array of top-level records
  const result = parseGedcom.parse(text);
  return result as unknown as GedcomNode[];
}

/**
 * Parse GEDCOM from a string (for testing).
 */
export function parseGedcomString(text: string): GedcomNode[] {
  const result = parseGedcom.parse(text);
  return result as unknown as GedcomNode[];
}
```

Note: `parse-gedcom` may export differently depending on version. The implementer should `console.log(parseGedcom)` to check if it's `parseGedcom.parse()` or `parseGedcom()` directly, and adapt the import accordingly. Check `node_modules/parse-gedcom/dist/index.js` for the actual export.

- [ ] **Step 2: Verify types compile**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/lib/gedcom/parse.ts
git commit -m "feat(gedcom): parser wrapper with encoding detection"
```

---

## Task 2: GEDCOM Mapper (TDD)

**Files:**
- Create: `apps/web/lib/gedcom/mapper.ts`
- Create: `apps/web/__tests__/gedcom/mapper.test.ts`

This is the core logic. TDD approach — write tests first, then implement.

- [ ] **Step 1: Write mapper tests**

Create `apps/web/__tests__/gedcom/mapper.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseGedcomString } from '../../lib/gedcom/parse';
import { mapGedcomToImport, parseGedcomName, parseGedcomDate } from '../../lib/gedcom/mapper';

describe('parseGedcomName', () => {
  it('parses /Surname/ convention', () => {
    const result = parseGedcomName('John /Smith/');
    expect(result.givenName).toBe('John');
    expect(result.surname).toBe('Smith');
  });

  it('parses name with suffix', () => {
    const result = parseGedcomName('John /Smith/ Jr');
    expect(result.givenName).toBe('John');
    expect(result.surname).toBe('Smith');
    expect(result.suffix).toBe('Jr');
  });

  it('parses name without surname delimiters', () => {
    const result = parseGedcomName('John Smith');
    expect(result.givenName).toBe('John');
    expect(result.surname).toBe('Smith');
  });

  it('handles empty name', () => {
    const result = parseGedcomName('');
    expect(result.givenName).toBe('');
    expect(result.surname).toBe('');
  });
});

describe('parseGedcomDate', () => {
  it('parses standard date', () => {
    const result = parseGedcomDate('15 MAR 1845');
    expect(result.dateOriginal).toBe('15 MAR 1845');
    expect(result.dateSort).toBe(18450315);
    expect(result.dateModifier).toBeNull();
  });

  it('parses ABT date', () => {
    const result = parseGedcomDate('ABT 1850');
    expect(result.dateOriginal).toBe('1850');
    expect(result.dateModifier).toBe('about');
  });

  it('parses BEF date', () => {
    const result = parseGedcomDate('BEF 1900');
    expect(result.dateModifier).toBe('before');
  });

  it('parses AFT date', () => {
    const result = parseGedcomDate('AFT 1800');
    expect(result.dateModifier).toBe('after');
  });

  it('parses BET/AND range', () => {
    const result = parseGedcomDate('BET 1880 AND 1885');
    expect(result.dateModifier).toBe('between');
    expect(result.dateSort).toBe(18800101);
    expect(result.dateEndSort).toBe(18850101);
  });

  it('returns null for empty date', () => {
    const result = parseGedcomDate('');
    expect(result.dateOriginal).toBeNull();
    expect(result.dateSort).toBeNull();
  });
});

describe('mapGedcomToImport', () => {
  it('maps INDI record to person + name', () => {
    const ast = parseGedcomString(
      '0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME John /Smith/\n1 SEX M\n0 TRLR'
    );
    const result = mapGedcomToImport(ast);
    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].sex).toBe('M');
    expect(result.names).toHaveLength(1);
    expect(result.names[0].givenName).toBe('John');
    expect(result.names[0].surname).toBe('Smith');
  });

  it('maps BIRT event', () => {
    const ast = parseGedcomString(
      '0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME John /Smith/\n1 SEX M\n1 BIRT\n2 DATE 15 MAR 1845\n2 PLAC Springfield, IL\n0 TRLR'
    );
    const result = mapGedcomToImport(ast);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventType).toBe('birth');
    expect(result.events[0].dateOriginal).toBe('15 MAR 1845');
    expect(result.events[0].placeText).toBe('Springfield, IL');
  });

  it('maps FAM record with HUSB/WIFE/CHIL', () => {
    const gedcom = [
      '0 HEAD', '1 CHAR UTF-8',
      '0 @I1@ INDI', '1 NAME John /Smith/', '1 SEX M',
      '0 @I2@ INDI', '1 NAME Mary /Jones/', '1 SEX F',
      '0 @I3@ INDI', '1 NAME William /Smith/', '1 SEX M',
      '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I3@',
      '0 TRLR',
    ].join('\n');
    const ast = parseGedcomString(gedcom);
    const result = mapGedcomToImport(ast);
    expect(result.families).toHaveLength(1);
    expect(result.childLinks).toHaveLength(1);
    expect(result.persons).toHaveLength(3);
  });

  it('detects living person (no DEAT, born recently)', () => {
    const year = new Date().getFullYear() - 50;
    const gedcom = `0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Test /Person/\n1 SEX M\n1 BIRT\n2 DATE ${year}\n0 TRLR`;
    const ast = parseGedcomString(gedcom);
    const result = mapGedcomToImport(ast);
    expect(result.persons[0].isLiving).toBe(true);
  });

  it('marks deceased person as not living', () => {
    const ast = parseGedcomString(
      '0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Test /Person/\n1 SEX M\n1 DEAT\n2 DATE 1920\n0 TRLR'
    );
    const result = mapGedcomToImport(ast);
    expect(result.persons[0].isLiving).toBe(false);
  });

  it('warns on death before birth', () => {
    const ast = parseGedcomString(
      '0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Bad /Dates/\n1 SEX M\n1 BIRT\n2 DATE 1900\n1 DEAT\n2 DATE 1850\n0 TRLR'
    );
    const result = mapGedcomToImport(ast);
    expect(result.warnings.some((w) => w.message.includes('death before birth'))).toBe(true);
  });

  it('warns on missing name', () => {
    const ast = parseGedcomString(
      '0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 SEX M\n0 TRLR'
    );
    const result = mapGedcomToImport(ast);
    expect(result.warnings.some((w) => w.message.includes('name'))).toBe(true);
  });

  it('counts skipped SOUR records', () => {
    const ast = parseGedcomString(
      '0 HEAD\n1 CHAR UTF-8\n0 @S1@ SOUR\n1 TITL A Source\n0 @S2@ SOUR\n1 TITL Another\n0 TRLR'
    );
    const result = mapGedcomToImport(ast);
    expect(result.stats.skippedSources).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run __tests__/gedcom/mapper.test.ts
```

Expected: FAIL (mapper.ts doesn't exist yet).

- [ ] **Step 3: Create apps/web/lib/gedcom/mapper.ts**

```typescript
import { parseDateToSort } from '@ancstra/shared';
import type {
  GedcomNode,
  GedcomImportData,
  GedcomPerson,
  GedcomName,
  GedcomFamily,
  GedcomChildLink,
  GedcomEvent,
  GedcomWarning,
} from './types';

// GEDCOM event tag → our event type
const EVENT_MAP: Record<string, string> = {
  BIRT: 'birth', DEAT: 'death', MARR: 'marriage', DIV: 'divorce',
  BURI: 'burial', RESI: 'residence', OCCU: 'occupation',
  IMMI: 'immigration', EMIG: 'emigration', MILI: 'military',
  EDUC: 'education', CENS: 'census', BAPM: 'baptism', CHR: 'baptism',
};

// GEDCOM date modifier prefixes
const DATE_MODIFIERS: Record<string, string> = {
  ABT: 'about', EST: 'estimated', CAL: 'calculated',
  BEF: 'before', AFT: 'after', INT: 'interpreted',
};

function findTag(nodes: GedcomNode[], tag: string): GedcomNode | undefined {
  return nodes.find((n) => n.tag === tag);
}

function findAllTags(nodes: GedcomNode[], tag: string): GedcomNode[] {
  return nodes.filter((n) => n.tag === tag);
}

export function parseGedcomName(nameStr: string): {
  givenName: string; surname: string; suffix: string | null; prefix: string | null;
} {
  if (!nameStr || !nameStr.trim()) {
    return { givenName: '', surname: '', suffix: null, prefix: null };
  }

  // GEDCOM convention: "Given /Surname/ Suffix"
  const slashMatch = nameStr.match(/^(.*?)\/([^/]*)\/(.*)?$/);
  if (slashMatch) {
    const given = slashMatch[1].trim();
    const surname = slashMatch[2].trim();
    const suffix = slashMatch[3]?.trim() || null;
    return { givenName: given, surname, suffix, prefix: null };
  }

  // Fallback: split on spaces, last word is surname
  const parts = nameStr.trim().split(/\s+/);
  if (parts.length === 1) {
    return { givenName: parts[0], surname: '', suffix: null, prefix: null };
  }
  const surname = parts.pop() || '';
  return { givenName: parts.join(' '), surname, suffix: null, prefix: null };
}

export function parseGedcomDate(dateStr: string): {
  dateOriginal: string | null;
  dateSort: number | null;
  dateModifier: string | null;
  dateEndSort: number | null;
} {
  if (!dateStr || !dateStr.trim()) {
    return { dateOriginal: null, dateSort: null, dateModifier: null, dateEndSort: null };
  }

  let str = dateStr.trim();

  // BET X AND Y
  const betMatch = str.match(/^BET\s+(.+?)\s+AND\s+(.+)$/i);
  if (betMatch) {
    const startDate = betMatch[1].trim();
    const endDate = betMatch[2].trim();
    return {
      dateOriginal: startDate,
      dateSort: parseDateToSort(startDate),
      dateModifier: 'between',
      dateEndSort: parseDateToSort(endDate),
    };
  }

  // Check for modifier prefix (ABT, BEF, AFT, EST, CAL, INT)
  for (const [prefix, modifier] of Object.entries(DATE_MODIFIERS)) {
    if (str.toUpperCase().startsWith(prefix + ' ')) {
      const actualDate = str.substring(prefix.length + 1).trim();
      return {
        dateOriginal: actualDate,
        dateSort: parseDateToSort(actualDate),
        dateModifier: modifier,
        dateEndSort: null,
      };
    }
  }

  // Standard date
  return {
    dateOriginal: str,
    dateSort: parseDateToSort(str),
    dateModifier: null,
    dateEndSort: null,
  };
}

export function mapGedcomToImport(ast: GedcomNode[]): GedcomImportData {
  const persons: GedcomPerson[] = [];
  const names: GedcomName[] = [];
  const families: GedcomFamily[] = [];
  const childLinks: GedcomChildLink[] = [];
  const events: GedcomEvent[] = [];
  const warnings: GedcomWarning[] = [];
  let skippedSources = 0;

  // XREF → UUID mapping
  const xrefMap = new Map<string, string>();
  const currentYear = new Date().getFullYear();

  // First pass: assign UUIDs to all INDI and FAM records
  for (const node of ast) {
    if (node.tag === 'INDI' || node.tag === 'FAM') {
      const xref = node.data; // e.g., "@I1@"
      xrefMap.set(xref, crypto.randomUUID());
    }
    if (node.tag === 'SOUR') {
      skippedSources++;
    }
  }

  // Second pass: extract data
  for (const node of ast) {
    if (node.tag === 'INDI') {
      const xref = node.data;
      const personId = xrefMap.get(xref)!;

      // Name
      const nameNode = findTag(node.tree, 'NAME');
      let givenName = '';
      let surname = '';
      let suffix: string | null = null;
      let prefix: string | null = null;

      if (nameNode) {
        const parsed = parseGedcomName(nameNode.data);
        givenName = parsed.givenName;
        surname = parsed.surname;
        suffix = parsed.suffix;
        prefix = parsed.prefix;

        // Override with explicit GIVN/SURN if present
        const givnNode = findTag(nameNode.tree, 'GIVN');
        const surnNode = findTag(nameNode.tree, 'SURN');
        if (givnNode?.data) givenName = givnNode.data;
        if (surnNode?.data) surname = surnNode.data;
      } else {
        warnings.push({ type: 'warning', message: 'Person has no name', xref });
      }

      // Sex
      const sexNode = findTag(node.tree, 'SEX');
      const sex = (sexNode?.data === 'M' || sexNode?.data === 'F') ? sexNode.data as 'M' | 'F' : 'U';

      // Notes
      const noteNode = findTag(node.tree, 'NOTE');
      const notes = noteNode?.data || null;

      // Events
      let birthDateSort: number | null = null;
      let hasDeath = false;

      for (const sub of node.tree) {
        const eventType = EVENT_MAP[sub.tag];
        if (!eventType) continue;
        if (sub.tag === 'DEAT') hasDeath = true;

        const dateNode = findTag(sub.tree, 'DATE');
        const placeNode = findTag(sub.tree, 'PLAC');
        const dateInfo = parseGedcomDate(dateNode?.data || '');

        if (sub.tag === 'BIRT' && dateInfo.dateSort) {
          birthDateSort = dateInfo.dateSort;
        }

        events.push({
          id: crypto.randomUUID(),
          eventType,
          dateOriginal: dateInfo.dateOriginal,
          dateSort: dateInfo.dateSort,
          dateModifier: dateInfo.dateModifier,
          dateEndSort: dateInfo.dateEndSort,
          placeText: placeNode?.data || null,
          personId: personId,
          familyId: null,
        });
      }

      // Living detection
      const birthYear = birthDateSort ? Math.floor(birthDateSort / 10000) : null;
      const isLiving = !hasDeath && birthYear !== null && (currentYear - birthYear) < 100;

      // Validation: death before birth
      const birthEvent = events.find((e) => e.personId === personId && e.eventType === 'birth');
      const deathEvent = events.find((e) => e.personId === personId && e.eventType === 'death');
      if (birthEvent?.dateSort && deathEvent?.dateSort && deathEvent.dateSort < birthEvent.dateSort) {
        warnings.push({ type: 'warning', message: `${givenName} ${surname}: death before birth`, xref });
      }

      persons.push({ id: personId, sex, isLiving, notes, xref });
      names.push({
        id: crypto.randomUUID(), personId,
        givenName: givenName || 'Unknown', surname: surname || 'Unknown',
        suffix, prefix, nameType: 'birth', isPrimary: true,
      });
    }

    if (node.tag === 'FAM') {
      const xref = node.data;
      const familyId = xrefMap.get(xref)!;

      const husbNode = findTag(node.tree, 'HUSB');
      const wifeNode = findTag(node.tree, 'WIFE');
      const partner1Id = husbNode?.data ? (xrefMap.get(husbNode.data) || null) : null;
      const partner2Id = wifeNode?.data ? (xrefMap.get(wifeNode.data) || null) : null;

      families.push({ id: familyId, partner1Id, partner2Id, xref });

      // Children
      for (const chilNode of findAllTags(node.tree, 'CHIL')) {
        const childPersonId = xrefMap.get(chilNode.data);
        if (childPersonId) {
          childLinks.push({ familyId, personId: childPersonId });
        }
      }

      // Marriage event on family
      const marrNode = findTag(node.tree, 'MARR');
      if (marrNode) {
        const dateNode = findTag(marrNode.tree, 'DATE');
        const placeNode = findTag(marrNode.tree, 'PLAC');
        const dateInfo = parseGedcomDate(dateNode?.data || '');

        events.push({
          id: crypto.randomUUID(),
          eventType: 'marriage',
          dateOriginal: dateInfo.dateOriginal,
          dateSort: dateInfo.dateSort,
          dateModifier: dateInfo.dateModifier,
          dateEndSort: dateInfo.dateEndSort,
          placeText: placeNode?.data || null,
          personId: null,
          familyId: familyId,
        });
      }
    }
  }

  return {
    persons, names, families, childLinks, events, warnings,
    stats: {
      persons: persons.length,
      families: families.length,
      events: events.length,
      skippedSources,
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run __tests__/gedcom/mapper.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/lib/gedcom/mapper.ts apps/web/__tests__/gedcom/mapper.test.ts
git commit -m "feat(gedcom): mapper with TDD — names, dates, events, living detection, warnings"
```

---

## Task 3: GEDCOM Serializer (TDD)

**Files:**
- Create: `apps/web/lib/gedcom/serialize.ts`
- Create: `apps/web/__tests__/gedcom/serialize.test.ts`

- [ ] **Step 1: Write serializer tests**

Create `apps/web/__tests__/gedcom/serialize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { serializeToGedcom } from '../../lib/gedcom/serialize';
import type { PersonListItem, FamilyRecord, ChildLink } from '@ancstra/shared';

const basePerson: PersonListItem = {
  id: 'p1', givenName: 'John', surname: 'Smith', sex: 'M',
  isLiving: false, birthDate: '15 MAR 1845', deathDate: '23 NOV 1923',
};

describe('serializeToGedcom', () => {
  it('includes HEAD and TRLR records', () => {
    const result = serializeToGedcom({ persons: [], families: [], childLinks: [], events: [] }, 'full');
    expect(result).toContain('0 HEAD');
    expect(result).toContain('1 SOUR Ancstra');
    expect(result).toContain('1 CHAR UTF-8');
    expect(result).toContain('0 TRLR');
  });

  it('serializes person with /Surname/ convention', () => {
    const result = serializeToGedcom({
      persons: [basePerson], families: [], childLinks: [],
      events: [
        { id: 'e1', eventType: 'birth', dateOriginal: '15 MAR 1845', dateSort: 18450315, dateModifier: null, dateEndSort: null, placeText: 'Springfield, IL', personId: 'p1', familyId: null, description: null, createdAt: '', updatedAt: '' },
      ],
    }, 'full');
    expect(result).toContain('1 NAME John /Smith/');
    expect(result).toContain('1 SEX M');
    expect(result).toContain('2 DATE 15 MAR 1845');
    expect(result).toContain('2 PLAC Springfield, IL');
  });

  it('serializes family with HUSB/WIFE/CHIL', () => {
    const persons: PersonListItem[] = [
      { id: 'p1', givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false, birthDate: null, deathDate: null },
      { id: 'p2', givenName: 'Mary', surname: 'Jones', sex: 'F', isLiving: false, birthDate: null, deathDate: null },
      { id: 'p3', givenName: 'William', surname: 'Smith', sex: 'M', isLiving: false, birthDate: null, deathDate: null },
    ];
    const families: FamilyRecord[] = [
      { id: 'f1', partner1Id: 'p1', partner2Id: 'p2', relationshipType: 'married', validationStatus: 'confirmed' },
    ];
    const childLinks: ChildLink[] = [{ familyId: 'f1', personId: 'p3', validationStatus: 'confirmed' }];
    const result = serializeToGedcom({ persons, families, childLinks, events: [] }, 'full');
    expect(result).toContain('1 HUSB @I1@');
    expect(result).toContain('1 WIFE @I2@');
    expect(result).toContain('1 CHIL @I3@');
  });

  it('shareable mode omits living persons', () => {
    const persons: PersonListItem[] = [
      { id: 'p1', givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false, birthDate: null, deathDate: null },
      { id: 'p2', givenName: 'Living', surname: 'Person', sex: 'F', isLiving: true, birthDate: null, deathDate: null },
    ];
    const result = serializeToGedcom({ persons, families: [], childLinks: [], events: [] }, 'shareable');
    expect(result).toContain('John /Smith/');
    expect(result).not.toContain('Living /Person/');
    // Living person should appear as "Living" placeholder
    expect(result).toContain('1 NAME Living //');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run __tests__/gedcom/serialize.test.ts
```

- [ ] **Step 3: Create apps/web/lib/gedcom/serialize.ts**

```typescript
import type { PersonListItem, FamilyRecord, ChildLink } from '@ancstra/shared';
import type { Event as EventType } from '@ancstra/shared';

interface SerializeInput {
  persons: PersonListItem[];
  families: FamilyRecord[];
  childLinks: ChildLink[];
  events: EventType[] | { id: string; eventType: string; dateOriginal: string | null; placeText: string | null; personId: string | null; familyId: string | null; [key: string]: unknown }[];
}

type ExportMode = 'full' | 'shareable';

const EVENT_TO_TAG: Record<string, string> = {
  birth: 'BIRT', death: 'DEAT', marriage: 'MARR', divorce: 'DIV',
  burial: 'BURI', residence: 'RESI', occupation: 'OCCU',
  immigration: 'IMMI', emigration: 'EMIG', military: 'MILI',
  education: 'EDUC', census: 'CENS', baptism: 'BAPM',
};

export function serializeToGedcom(data: SerializeInput, mode: ExportMode): string {
  const { persons, families, childLinks, events } = data;
  const lines: string[] = [];

  // Build UUID → XREF maps
  const personXref = new Map<string, string>();
  const familyXref = new Map<string, string>();

  // Filter persons for shareable mode
  const livingIds = new Set(persons.filter((p) => p.isLiving).map((p) => p.id));

  let personIdx = 0;
  for (const p of persons) {
    personIdx++;
    personXref.set(p.id, `@I${personIdx}@`);
  }

  let familyIdx = 0;
  for (const f of families) {
    familyIdx++;
    familyXref.set(f.id, `@F${familyIdx}@`);
  }

  // HEAD
  lines.push('0 HEAD');
  lines.push('1 SOUR Ancstra');
  lines.push('2 NAME Ancstra');
  lines.push('2 VERS 1.0');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');

  // INDI records
  for (const p of persons) {
    const xref = personXref.get(p.id)!;

    if (mode === 'shareable' && p.isLiving) {
      // Placeholder for living person
      lines.push(`0 ${xref} INDI`);
      lines.push('1 NAME Living //');
      lines.push(`1 SEX ${p.sex}`);
      continue;
    }

    lines.push(`0 ${xref} INDI`);
    lines.push(`1 NAME ${p.givenName} /${p.surname}/`);
    lines.push(`2 GIVN ${p.givenName}`);
    lines.push(`2 SURN ${p.surname}`);
    lines.push(`1 SEX ${p.sex}`);

    // Person events
    const personEvents = events.filter((e) => e.personId === p.id);
    for (const evt of personEvents) {
      const tag = EVENT_TO_TAG[evt.eventType];
      if (!tag) continue;
      lines.push(`1 ${tag}`);
      if (evt.dateOriginal) lines.push(`2 DATE ${evt.dateOriginal}`);
      if (evt.placeText) lines.push(`2 PLAC ${evt.placeText}`);
    }
  }

  // FAM records
  for (const f of families) {
    const xref = familyXref.get(f.id)!;
    lines.push(`0 ${xref} FAM`);

    if (f.partner1Id && personXref.has(f.partner1Id)) {
      lines.push(`1 HUSB ${personXref.get(f.partner1Id)}`);
    }
    if (f.partner2Id && personXref.has(f.partner2Id)) {
      lines.push(`1 WIFE ${personXref.get(f.partner2Id)}`);
    }

    // Children
    for (const cl of childLinks.filter((c) => c.familyId === f.id)) {
      if (personXref.has(cl.personId)) {
        lines.push(`1 CHIL ${personXref.get(cl.personId)}`);
      }
    }

    // Family events (marriage)
    const famEvents = events.filter((e) => e.familyId === f.id);
    for (const evt of famEvents) {
      const tag = EVENT_TO_TAG[evt.eventType];
      if (!tag) continue;
      lines.push(`1 ${tag}`);
      if (evt.dateOriginal) lines.push(`2 DATE ${evt.dateOriginal}`);
      if (evt.placeText) lines.push(`2 PLAC ${evt.placeText}`);
    }
  }

  // TRLR
  lines.push('0 TRLR');

  // UTF-8 BOM + newlines
  return '\ufeff' + lines.join('\n') + '\n';
}
```

- [ ] **Step 4: Run tests**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run __tests__/gedcom/serialize.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/lib/gedcom/serialize.ts apps/web/__tests__/gedcom/serialize.test.ts
git commit -m "feat(gedcom): serializer with TDD — GEDCOM 5.5.1 export with privacy modes"
```

---

## Task 4: Import Server Actions

**Files:**
- Create: `apps/web/app/actions/import-gedcom.ts`

- [ ] **Step 1: Create the import server actions**

```typescript
'use server';

import { auth } from '@/auth';
import { createDb, persons, personNames, families, children, events } from '@ancstra/db';
import { isNull, sql } from 'drizzle-orm';
import { parseGedcomFile } from '@/lib/gedcom/parse';
import { mapGedcomToImport } from '@/lib/gedcom/mapper';
import type { GedcomImportData, GedcomPreview } from '@/lib/gedcom/types';

export async function previewGedcom(formData: FormData): Promise<GedcomPreview> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  const buffer = await file.arrayBuffer();
  const ast = parseGedcomFile(buffer);
  const data = mapGedcomToImport(ast);

  // Count existing persons
  const db = createDb();
  const [{ count }] = db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(isNull(persons.deletedAt))
    .all();

  return {
    stats: data.stats,
    warnings: data.warnings,
    existingPersonCount: count,
  };
}

// Note: The file is re-parsed in commit (not passed from preview) because
// server actions can't hold state between calls. This generates new UUIDs,
// which is fine — we're doing a fresh insert, not updating preview data.
// Stats/warnings are deterministic for the same file content.
export async function commitGedcomImport(formData: FormData): Promise<{
  imported: { persons: number; families: number; events: number };
}> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  const buffer = await file.arrayBuffer();
  const ast = parseGedcomFile(buffer);
  const data = mapGedcomToImport(ast);

  const db = createDb();
  const now = new Date().toISOString();

  db.transaction((tx) => {
    // 1. Insert persons
    for (const p of data.persons) {
      tx.insert(persons).values({
        id: p.id,
        sex: p.sex,
        isLiving: p.isLiving,
        notes: p.notes,
        createdBy: session.user?.id ?? null,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    // 2. Insert names
    for (const n of data.names) {
      tx.insert(personNames).values({
        id: n.id,
        personId: n.personId,
        givenName: n.givenName,
        surname: n.surname,
        suffix: n.suffix,
        prefix: n.prefix,
        nameType: n.nameType as 'birth',
        isPrimary: n.isPrimary,
        createdAt: now,
      }).run();
    }

    // 3. Insert families
    for (const f of data.families) {
      tx.insert(families).values({
        id: f.id,
        partner1Id: f.partner1Id,
        partner2Id: f.partner2Id,
        validationStatus: 'confirmed',
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    // 4. Insert child links
    for (const cl of data.childLinks) {
      tx.insert(children).values({
        id: crypto.randomUUID(),
        familyId: cl.familyId,
        personId: cl.personId,
        validationStatus: 'confirmed',
        createdAt: now,
      }).run();
    }

    // 5. Insert events
    for (const e of data.events) {
      tx.insert(events).values({
        id: e.id,
        eventType: e.eventType,
        dateOriginal: e.dateOriginal,
        dateSort: e.dateSort,
        dateModifier: e.dateModifier as any,
        dateEndSort: e.dateEndSort,
        placeText: e.placeText,
        personId: e.personId,
        familyId: e.familyId,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  });

  return {
    imported: {
      persons: data.stats.persons,
      families: data.stats.families,
      events: data.stats.events,
    },
  };
}
```

- [ ] **Step 2: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/app/actions/import-gedcom.ts
git commit -m "feat(gedcom): import server actions — preview + transactional commit"
```

---

## Task 5: Export Server Action

**Files:**
- Create: `apps/web/app/actions/export-gedcom.ts`

- [ ] **Step 1: Create the export server action**

```typescript
'use server';

import { auth } from '@/auth';
import { createDb, events } from '@ancstra/db';
import { getTreeData } from '@/lib/queries';
import { serializeToGedcom } from '@/lib/gedcom/serialize';

export async function exportGedcom(formData: FormData): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const mode = (formData.get('mode') as string) || 'full';
  if (mode !== 'full' && mode !== 'shareable') throw new Error('Invalid mode');

  const db = createDb();
  const treeData = getTreeData(db);

  // Fetch all events for export
  const allEvents = db.select().from(events).all();

  const gedcom = serializeToGedcom({
    persons: treeData.persons,
    families: treeData.families,
    childLinks: treeData.childLinks,
    events: allEvents,
  }, mode as 'full' | 'shareable');

  return gedcom;
}
```

- [ ] **Step 2: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/app/actions/export-gedcom.ts
git commit -m "feat(gedcom): export server action with privacy mode filtering"
```

---

## Task 6: Import UI (Two-Step Wizard)

**Files:**
- Create: `apps/web/components/gedcom-import.tsx`
- Create: `apps/web/app/(auth)/import/page.tsx`

- [ ] **Step 1: Create gedcom-import.tsx**

Client component managing the two-step wizard flow:

- Step 1: Drag-and-drop file upload zone (accepts `.ged`). On file select, calls `previewGedcom` server action.
- Step 2: Shows stats (persons, families, events, skipped sources), warnings list, existing data note. Confirm button calls `commitGedcomImport`, then `router.push('/tree')`.

Use shadcn Card, Button. Use `useState` to track step (upload/preview/importing/done), preview data, file reference, loading states, errors.

The drag-and-drop zone: a bordered dashed div with `onDragOver`, `onDrop`, and hidden file input. Click to browse.

- [ ] **Step 2: Create import/page.tsx**

```typescript
import { GedcomImport } from '@/components/gedcom-import';

export default function ImportPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-semibold mb-6">Import GEDCOM File</h1>
      <GedcomImport />
    </div>
  );
}
```

- [ ] **Step 3: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/gedcom-import.tsx "apps/web/app/(auth)/import/page.tsx"
git commit -m "feat(gedcom): import UI — two-step wizard with drag-and-drop upload"
```

---

## Task 7: Export UI

**Files:**
- Create: `apps/web/app/(auth)/export/page.tsx`

- [ ] **Step 1: Create export/page.tsx**

Client component with:
- Radio buttons: "Full backup (includes all data)" / "Shareable (hides living persons)"
- Stats showing person count + living count (fetched from `GET /api/persons`)
- "Download .ged" button that calls `exportGedcom` server action and triggers browser download

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { exportGedcom } from '@/app/actions/export-gedcom';

export default function ExportPage() {
  const [mode, setMode] = useState<'full' | 'shareable'>('full');
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<{ total: number; living: number } | null>(null);

  useEffect(() => {
    // Fetch all persons to count living
    fetch('/api/persons?pageSize=9999')
      .then((r) => r.json())
      .then((d) => {
        const living = d.items.filter((p: { isLiving: boolean }) => p.isLiving).length;
        setStats({ total: d.total, living });
      })
      .catch(() => {});
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const formData = new FormData();
      formData.set('mode', mode);
      const gedcom = await exportGedcom(formData);

      // Trigger browser download
      const blob = new Blob([gedcom], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ancstra-export-${mode}.ged`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('GEDCOM exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-semibold mb-6">Export GEDCOM</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="mode" value="full" checked={mode === 'full'} onChange={() => setMode('full')} className="accent-primary" />
              <div>
                <div className="text-sm font-medium">Full backup</div>
                <div className="text-xs text-muted-foreground">Includes all persons and events — suitable for personal backup</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="mode" value="shareable" checked={mode === 'shareable'} onChange={() => setMode('shareable')} className="accent-primary" />
              <div>
                <div className="text-sm font-medium">Shareable</div>
                <div className="text-xs text-muted-foreground">Hides living persons — suitable for sharing with other genealogists</div>
              </div>
            </label>
          </div>

          {stats && (
            <p className="text-sm text-muted-foreground">
              {stats.total} persons in your tree
              {mode === 'shareable' && stats.living > 0 && (
                <> ({stats.living} living persons will be hidden)</>
              )}
            </p>
          )}

          <Button onClick={handleExport} disabled={exporting || !stats?.total}>
            {exporting ? 'Exporting...' : 'Download .ged'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add "apps/web/app/(auth)/export/page.tsx"
git commit -m "feat(gedcom): export page with full + shareable privacy modes"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Type check**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
```

- [ ] **Step 2: Run all tests**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
```

Expected: All tests pass (existing 38 + new mapper ~12 + serializer ~4 = ~54 total).

- [ ] **Step 3: Manual smoke test**

```bash
cd D:/projects/ancstra/apps/web && pnpm dev
```

Import test:
1. Find or create a small `.ged` test file (or use one from the internet)
2. Navigate to `/import`
3. Upload the file → see preview with stats and warnings
4. Click "Import" → redirect to `/tree`
5. Verify persons appear on the tree canvas

Export test:
1. Navigate to `/export`
2. Select "Full backup" → Download → open in text editor → verify valid GEDCOM
3. Select "Shareable" → Download → verify living persons replaced with "Living"

Roundtrip test:
1. Export as full → re-import the exported file → verify same person count

- [ ] **Step 4: Commit any remaining changes**

---

## Summary

| Task | Description | Depends On |
|------|-------------|-----------|
| 0 | Install parse-gedcom + types | — |
| 1 | Parser (encoding + parse-gedcom wrapper) | 0 |
| 2 | Mapper with TDD (names, dates, events, warnings) | 0, 1 |
| 3 | Serializer with TDD (DB→GEDCOM, privacy modes) | 0 |
| 4 | Import server actions (preview + commit) | 1, 2 |
| 5 | Export server action | 3 |
| 6 | Import UI (two-step wizard) | 4 |
| 7 | Export UI (mode select + download) | 5 |
| 8 | Final verification | All |

**Critical path:** 0 → 1 → 2 → 4 → 6

**Parallelizable:** Task 3 parallel with Tasks 1-2. Task 5 parallel with Task 4. Tasks 6 and 7 parallel after their deps.
