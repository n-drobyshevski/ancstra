export const FACT_TYPES = [
  'name', 'birth_date', 'birth_place', 'death_date', 'death_place',
  'marriage_date', 'marriage_place', 'residence', 'occupation',
  'immigration', 'military_service', 'religion', 'ethnicity',
  'parent_name', 'spouse_name', 'child_name', 'other',
] as const;

export type FactType = typeof FACT_TYPES[number];

export const FACT_TYPE_LABELS: Record<FactType, string> = {
  name: 'Name',
  birth_date: 'Birth Date',
  birth_place: 'Birth Place',
  death_date: 'Death Date',
  death_place: 'Death Place',
  marriage_date: 'Marriage Date',
  marriage_place: 'Marriage Place',
  residence: 'Residence',
  occupation: 'Occupation',
  immigration: 'Immigration',
  military_service: 'Military Service',
  religion: 'Religion',
  ethnicity: 'Ethnicity',
  parent_name: 'Parent Name',
  spouse_name: 'Spouse Name',
  child_name: 'Child Name',
  other: 'Other',
};

/** Keyboard shortcut → fact type mapping for the context menu */
export const SHORTCUT_TYPES: Record<string, FactType> = {
  b: 'birth_date',
  d: 'death_date',
  m: 'marriage_date',
  n: 'name',
  o: 'occupation',
  r: 'residence',
  p: 'birth_place',
  s: 'spouse_name',
};

/** Reverse: fact type → shortcut letter (only for types that have one) */
export const TYPE_SHORTCUTS: Partial<Record<FactType, string>> = Object.fromEntries(
  Object.entries(SHORTCUT_TYPES).map(([key, val]) => [val, key.toUpperCase()]),
);

export interface DraftFact {
  id: string;
  factType: FactType;
  factValue: string;
  selectedText: string;
  textRange: { start: number; end: number } | null;
  confidence: 'high' | 'medium' | 'low';
  addedAt: number;
}

export interface ExtractionSession {
  factsheetId: string | null;
  factsheetTitle: string;
  researchItemId: string;
  facts: DraftFact[];
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  selectedText: string;
  suggestedType: FactType | null;
  textRange: { start: number; end: number } | null;
}
