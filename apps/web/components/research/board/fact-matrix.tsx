'use client';

import { useMemo } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from '@/components/ui/table';
import { FactMatrixRow, type MatrixCell } from './fact-matrix-row';

interface Fact {
  id: string;
  factType: string;
  factValue: string;
  confidence: string;
  researchItemId: string | null;
}

interface ResearchItem {
  id: string;
  title: string;
  status: string;
}

interface MatrixRow {
  factType: string;
  cells: (MatrixCell | null)[];
}

// ---------------------------------------------------------------------------
// buildMatrix — transforms flat facts + items into rows x columns
// ---------------------------------------------------------------------------
export function buildMatrix(
  facts: Fact[],
  items: ResearchItem[],
): { columns: ResearchItem[]; rows: MatrixRow[] } {
  // Only include items that are promoted or draft (not dismissed)
  const columns = items.filter((it) => it.status !== 'dismissed');

  // Collect unique fact types
  const factTypes = Array.from(new Set(facts.map((f) => f.factType))).sort();

  const rows: MatrixRow[] = factTypes.map((factType) => {
    // All facts of this type
    const typeFacts = facts.filter((f) => f.factType === factType);

    // Unique values for conflict detection
    const uniqueValues = new Set(typeFacts.map((f) => f.factValue.toLowerCase().trim()));
    const hasConflict = uniqueValues.size > 1;

    const cells: (MatrixCell | null)[] = columns.map((item) => {
      const fact = typeFacts.find((f) => f.researchItemId === item.id);
      if (!fact) return null;

      return {
        factId: fact.id,
        value: fact.factValue,
        confidence: fact.confidence,
        hasConflict,
      };
    });

    return { factType, cells };
  });

  return { columns, rows };
}

// ---------------------------------------------------------------------------
// FactMatrix component
// ---------------------------------------------------------------------------
interface FactMatrixProps {
  facts: Fact[];
  items: ResearchItem[];
}

export function FactMatrix({ facts, items }: FactMatrixProps) {
  const { columns, rows } = useMemo(
    () => buildMatrix(facts, items),
    [facts, items],
  );

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <svg className="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">
          No facts to compare yet.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Extract facts from your research items to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-card">
          <TableRow>
            <TableHead className="sticky left-0 z-30 bg-card min-w-[140px]">
              Fact Type
            </TableHead>
            {columns.map((col) => (
              <TableHead key={col.id} className="min-w-[140px]">
                <span className="line-clamp-2">{col.title}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <FactMatrixRow
              key={row.factType}
              factType={row.factType}
              cells={row.cells}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
