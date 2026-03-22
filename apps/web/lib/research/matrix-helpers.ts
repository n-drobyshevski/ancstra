'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatrixSource {
  id: string;
  title: string;
  type: 'research_item' | 'source';
  status?: string;
  confidence?: string;
}

export interface MatrixCell {
  factId: string;
  value: string;
  confidence: string;
  extractionMethod: string;
  sourceTitle: string;
}

export interface ConflictInfo {
  factType: string;
  values: {
    factId: string;
    value: string;
    sourceTitle: string;
    confidence: string;
  }[];
}

export interface MatrixData {
  factTypes: string[];
  sources: MatrixSource[];
  cells: Record<string, Record<string, MatrixCell>>;
  conclusions: Record<string, string>;
  conflicts: Record<string, ConflictInfo>;
}

// ---------------------------------------------------------------------------
// Canonical fact type ordering
// ---------------------------------------------------------------------------

const CANONICAL_ORDER = [
  'name',
  'given_name',
  'surname',
  'birth_date',
  'birth_place',
  'death_date',
  'death_place',
  'marriage_date',
  'marriage_place',
  'burial_date',
  'burial_place',
];

const MULTI_VALUE_TYPES = new Set([
  'residence',
  'occupation',
  'child_name',
  'other',
]);

function sortFactTypes(types: string[]): string[] {
  return [...types].sort((a, b) => {
    const ai = CANONICAL_ORDER.indexOf(a);
    const bi = CANONICAL_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

// ---------------------------------------------------------------------------
// buildMatrix
// ---------------------------------------------------------------------------

interface FactInput {
  id: string;
  factType: string;
  factValue: string;
  confidence: string;
  researchItemId: string | null;
  notes?: string | null;
  createdAt?: string;
}

interface ResearchItemInput {
  id: string;
  title: string;
  status: string;
}

export function buildMatrix(
  facts: FactInput[],
  items: ResearchItemInput[],
): MatrixData {
  // Build sources from research items (exclude dismissed)
  const sources: MatrixSource[] = items
    .filter((it) => it.status !== 'dismissed')
    .map((it) => ({
      id: it.id,
      title: it.title,
      type: 'research_item' as const,
      status: it.status,
    }));

  // Collect unique fact types
  const factTypeSet = new Set(facts.map((f) => f.factType));
  const factTypes = sortFactTypes(Array.from(factTypeSet));

  // Build cell map: cells[factType][sourceId] = MatrixCell
  const cells: Record<string, Record<string, MatrixCell>> = {};
  for (const ft of factTypes) {
    cells[ft] = {};
  }

  for (const fact of facts) {
    const sourceId = fact.researchItemId;
    if (!sourceId) continue;
    const source = sources.find((s) => s.id === sourceId);
    if (!source) continue;

    cells[fact.factType][sourceId] = {
      factId: fact.id,
      value: fact.factValue,
      confidence: fact.confidence,
      extractionMethod: fact.notes ?? 'extracted',
      sourceTitle: source.title,
    };
  }

  // Detect conflicts: 2+ different values in non-multi-value fact types
  const conflicts: Record<string, ConflictInfo> = {};
  for (const ft of factTypes) {
    if (MULTI_VALUE_TYPES.has(ft)) continue;

    const rowCells = Object.values(cells[ft]);
    if (rowCells.length < 2) continue;

    const uniqueValues = new Set(
      rowCells.map((c) => c.value.toLowerCase().trim()),
    );
    if (uniqueValues.size > 1) {
      conflicts[ft] = {
        factType: ft,
        values: rowCells.map((c) => ({
          factId: c.factId,
          value: c.value,
          sourceTitle: c.sourceTitle,
          confidence: c.confidence,
        })),
      };
    }
  }

  return {
    factTypes,
    sources,
    cells,
    conclusions: {},
    conflicts,
  };
}

// ---------------------------------------------------------------------------
// useConclusionsForPerson — localStorage-backed conclusions with debounced API
// ---------------------------------------------------------------------------

export function useConclusionsForPerson(personId: string) {
  const [conclusions, setConclusions] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const key = `ancstra:conclusions:${personId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setConclusions(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
    }
  }, [personId]);

  const persistToStorage = useCallback(
    (updated: Record<string, string>) => {
      const key = `ancstra:conclusions:${personId}`;
      try {
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
    },
    [personId],
  );

  const updateConclusion = useCallback(
    (factType: string, value: string) => {
      setConclusions((prev) => {
        const updated = { ...prev, [factType]: value };
        persistToStorage(updated);

        // Debounced save indicator
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setIsSaving(true);
        saveTimerRef.current = setTimeout(() => {
          setIsSaving(false);
        }, 800);

        return updated;
      });
    },
    [persistToStorage],
  );

  return { conclusions, updateConclusion, isSaving };
}
