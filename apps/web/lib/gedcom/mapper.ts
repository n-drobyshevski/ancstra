import { parseDateToSort } from '@ancstra/shared';
import type {
  GedcomImportData,
  GedcomPerson,
  GedcomName,
  GedcomFamily,
  GedcomChildLink,
  GedcomEvent,
  GedcomWarning,
} from './types';

// ---------------------------------------------------------------------------
// Internal types — parse-gedcom's actual AST shape differs from GedcomNode
// ---------------------------------------------------------------------------
interface ParsedNode {
  type: string;
  value?: string;
  data?: { xref_id?: string; pointer?: string; formal_name?: string };
  children?: ParsedNode[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findChild(node: ParsedNode, tag: string): ParsedNode | undefined {
  return node.children?.find((c) => c.type === tag);
}

function findChildren(node: ParsedNode, tag: string): ParsedNode[] {
  return node.children?.filter((c) => c.type === tag) ?? [];
}

function childValue(node: ParsedNode, tag: string): string {
  return findChild(node, tag)?.value ?? '';
}

// ---------------------------------------------------------------------------
// parseGedcomName
// ---------------------------------------------------------------------------
export interface ParsedGedcomName {
  givenName: string;
  surname: string;
  suffix: string | null;
}

export function parseGedcomName(nameStr: string): ParsedGedcomName {
  if (!nameStr || !nameStr.trim()) {
    return { givenName: '', surname: '', suffix: null };
  }

  const slashMatch = nameStr.match(/^(.*?)\/([^/]*)\/(.*)$/);
  if (slashMatch) {
    const givenName = slashMatch[1].trim();
    const surname = slashMatch[2].trim();
    const suffix = slashMatch[3].trim() || null;
    return { givenName, surname, suffix };
  }

  // Fallback: last word is surname, rest is given
  const parts = nameStr.trim().split(/\s+/);
  if (parts.length === 1) {
    return { givenName: parts[0], surname: '', suffix: null };
  }
  const surname = parts.pop()!;
  return { givenName: parts.join(' '), surname, suffix: null };
}

// ---------------------------------------------------------------------------
// parseGedcomDate
// ---------------------------------------------------------------------------
export interface ParsedGedcomDate {
  dateOriginal: string | null;
  dateSort: number | null;
  dateModifier: string | null;
  dateEndSort: number | null;
}

const DATE_MODIFIERS: Record<string, string> = {
  ABT: 'about',
  EST: 'estimated',
  CAL: 'calculated',
  BEF: 'before',
  AFT: 'after',
  INT: 'interpreted',
};

export function parseGedcomDate(dateStr: string): ParsedGedcomDate {
  if (!dateStr || !dateStr.trim()) {
    return { dateOriginal: null, dateSort: null, dateModifier: null, dateEndSort: null };
  }

  const s = dateStr.trim();

  // BET X AND Y
  const betMatch = s.match(/^BET\s+(.+?)\s+AND\s+(.+)$/i);
  if (betMatch) {
    return {
      dateOriginal: s,
      dateSort: parseDateToSort(betMatch[1].trim()),
      dateModifier: 'between',
      dateEndSort: parseDateToSort(betMatch[2].trim()),
    };
  }

  // Modifier prefix (ABT, BEF, AFT, EST, CAL, INT)
  const modMatch = s.match(/^(ABT|EST|CAL|BEF|AFT|INT)\s+(.+)$/i);
  if (modMatch) {
    const modifier = DATE_MODIFIERS[modMatch[1].toUpperCase()];
    const rawDate = modMatch[2].trim();
    return {
      dateOriginal: s,
      dateSort: parseDateToSort(rawDate),
      dateModifier: modifier ?? null,
      dateEndSort: null,
    };
  }

  // Exact date
  return {
    dateOriginal: s,
    dateSort: parseDateToSort(s),
    dateModifier: null,
    dateEndSort: null,
  };
}

// ---------------------------------------------------------------------------
// Event tag mapping
// ---------------------------------------------------------------------------
const EVENT_TAG_MAP: Record<string, string> = {
  BIRT: 'birth',
  DEAT: 'death',
  MARR: 'marriage',
  DIV: 'divorce',
  BURI: 'burial',
  RESI: 'residence',
  OCCU: 'occupation',
  IMMI: 'immigration',
  EMIG: 'emigration',
  MILI: 'military',
  EDUC: 'education',
  CENS: 'census',
  BAPM: 'baptism',
  CHR: 'baptism',
};

const PERSON_EVENT_TAGS = new Set(Object.keys(EVENT_TAG_MAP));
const FAMILY_EVENT_TAGS = new Set(['MARR', 'DIV']);

// ---------------------------------------------------------------------------
// mapGedcomToImport
// ---------------------------------------------------------------------------
export function mapGedcomToImport(ast: unknown): GedcomImportData {
  // parse-gedcom returns { type: "root", children: [...] } cast as GedcomNode[]
  const root = ast as ParsedNode;
  const topNodes: ParsedNode[] = root.children ?? (Array.isArray(ast) ? (ast as ParsedNode[]) : []);

  const persons: GedcomPerson[] = [];
  const names: GedcomName[] = [];
  const families: GedcomFamily[] = [];
  const childLinks: GedcomChildLink[] = [];
  const events: GedcomEvent[] = [];
  const warnings: GedcomWarning[] = [];

  // xref → UUID mapping (pass 1)
  const xrefToId = new Map<string, string>();
  let skippedSources = 0;

  for (const node of topNodes) {
    const xref = node.data?.xref_id;
    if (node.type === 'INDI' && xref) {
      xrefToId.set(xref, crypto.randomUUID());
    } else if (node.type === 'FAM' && xref) {
      xrefToId.set(xref, crypto.randomUUID());
    } else if (node.type === 'SOUR') {
      skippedSources++;
    }
  }

  // Pass 2: extract data
  for (const node of topNodes) {
    if (node.type === 'INDI') {
      processIndi(node, xrefToId, persons, names, events, warnings);
    } else if (node.type === 'FAM') {
      processFam(node, xrefToId, families, childLinks, events, warnings);
    }
  }

  return {
    persons,
    names,
    families,
    childLinks,
    events,
    warnings,
    stats: {
      persons: persons.length,
      families: families.length,
      events: events.length,
      skippedSources,
    },
  };
}

// ---------------------------------------------------------------------------
// Process INDI
// ---------------------------------------------------------------------------
function processIndi(
  node: ParsedNode,
  xrefToId: Map<string, string>,
  persons: GedcomPerson[],
  names: GedcomName[],
  events: GedcomEvent[],
  warnings: GedcomWarning[],
) {
  const xref = node.data?.xref_id ?? '';
  const personId = xrefToId.get(xref) ?? crypto.randomUUID();

  // Sex
  const sexVal = childValue(node, 'SEX').toUpperCase();
  const sex: 'M' | 'F' | 'U' = sexVal === 'M' ? 'M' : sexVal === 'F' ? 'F' : 'U';

  // Notes
  const noteNode = findChild(node, 'NOTE');
  const notes = noteNode?.value ?? null;

  // Names
  const nameNodes = findChildren(node, 'NAME');
  if (nameNodes.length === 0) {
    warnings.push({ type: 'warning', message: `Missing name for individual`, xref });
  }

  nameNodes.forEach((nameNode, idx) => {
    const rawName = nameNode.value ?? '';
    const parsed = parseGedcomName(rawName);

    // Check for GIVN/SURN sub-tags that override
    const givnNode = findChild(nameNode, 'GIVN');
    const surnNode = findChild(nameNode, 'SURN');
    const npfxNode = findChild(nameNode, 'NPFX');
    const nsfxNode = findChild(nameNode, 'NSFX');

    const givenName = givnNode?.value ?? parsed.givenName;
    const surname = surnNode?.value ?? parsed.surname;
    const prefix = npfxNode?.value ?? null;
    const suffix = nsfxNode?.value ?? parsed.suffix;

    names.push({
      id: crypto.randomUUID(),
      personId,
      givenName,
      surname,
      suffix,
      prefix,
      nameType: 'birth',
      isPrimary: idx === 0,
    });
  });

  // Events
  let birthDateSort: number | null = null;
  let deathDateSort: number | null = null;
  let hasDeath = false;

  for (const child of node.children ?? []) {
    if (!PERSON_EVENT_TAGS.has(child.type)) continue;

    const eventType = EVENT_TAG_MAP[child.type];
    if (!eventType) continue;

    const dateStr = childValue(child, 'DATE');
    const placeStr = childValue(child, 'PLAC');
    const dateInfo = parseGedcomDate(dateStr);

    const event: GedcomEvent = {
      id: crypto.randomUUID(),
      eventType,
      dateOriginal: dateInfo.dateOriginal,
      dateSort: dateInfo.dateSort,
      dateModifier: dateInfo.dateModifier,
      dateEndSort: dateInfo.dateEndSort,
      placeText: placeStr || null,
      personId,
      familyId: null,
    };
    events.push(event);

    if (child.type === 'BIRT') birthDateSort = dateInfo.dateSort;
    if (child.type === 'DEAT') {
      hasDeath = true;
      deathDateSort = dateInfo.dateSort;
    }
  }

  // Living detection
  const isLiving = detectLiving(hasDeath, birthDateSort);

  // Validate: death before birth
  if (birthDateSort != null && deathDateSort != null && deathDateSort < birthDateSort) {
    warnings.push({
      type: 'warning',
      message: `Death before birth detected`,
      xref,
    });
  }

  persons.push({
    id: personId,
    sex,
    isLiving,
    notes,
    xref,
  });
}

// ---------------------------------------------------------------------------
// Process FAM
// ---------------------------------------------------------------------------
function processFam(
  node: ParsedNode,
  xrefToId: Map<string, string>,
  families: GedcomFamily[],
  childLinks: GedcomChildLink[],
  events: GedcomEvent[],
  _warnings: GedcomWarning[],
) {
  const xref = node.data?.xref_id ?? '';
  const familyId = xrefToId.get(xref) ?? crypto.randomUUID();

  const husbNode = findChild(node, 'HUSB');
  const wifeNode = findChild(node, 'WIFE');

  const partner1Id = husbNode?.data?.pointer ? (xrefToId.get(husbNode.data.pointer) ?? null) : null;
  const partner2Id = wifeNode?.data?.pointer ? (xrefToId.get(wifeNode.data.pointer) ?? null) : null;

  families.push({ id: familyId, partner1Id, partner2Id, xref });

  // Children
  for (const chilNode of findChildren(node, 'CHIL')) {
    const childXref = chilNode.data?.pointer;
    if (childXref) {
      const childPersonId = xrefToId.get(childXref);
      if (childPersonId) {
        childLinks.push({ familyId, personId: childPersonId });
      }
    }
  }

  // Family events (MARR, DIV)
  for (const child of node.children ?? []) {
    if (!FAMILY_EVENT_TAGS.has(child.type)) continue;

    const eventType = EVENT_TAG_MAP[child.type];
    if (!eventType) continue;

    const dateStr = childValue(child, 'DATE');
    const placeStr = childValue(child, 'PLAC');
    const dateInfo = parseGedcomDate(dateStr);

    events.push({
      id: crypto.randomUUID(),
      eventType,
      dateOriginal: dateInfo.dateOriginal,
      dateSort: dateInfo.dateSort,
      dateModifier: dateInfo.dateModifier,
      dateEndSort: dateInfo.dateEndSort,
      placeText: placeStr || null,
      personId: null,
      familyId,
    });
  }
}

// ---------------------------------------------------------------------------
// Living detection
// ---------------------------------------------------------------------------
function detectLiving(hasDeath: boolean, birthDateSort: number | null): boolean {
  if (hasDeath) return false;

  if (birthDateSort == null) {
    // No birth date and no death — assume living (safer default)
    return true;
  }

  const birthYear = Math.floor(birthDateSort / 10000);
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear < 100;
}
