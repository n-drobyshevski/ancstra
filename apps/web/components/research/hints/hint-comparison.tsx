'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PersonSummary {
  givenName: string;
  surname: string;
  birthDate?: string | null;
  birthPlace?: string | null;
  deathDate?: string | null;
  deathPlace?: string | null;
}

interface ExternalRecordData {
  name?: string;
  birthDate?: string;
  birthPlace?: string;
  location?: string;
  deathDate?: string;
  deathPlace?: string;
  [key: string]: unknown;
}

interface HintComparisonProps {
  localPerson: PersonSummary;
  externalRecord: ExternalRecordData;
}

interface FieldRow {
  label: string;
  local: string | null | undefined;
  external: string | null | undefined;
}

function fieldStatus(local: string | null | undefined, external: string | null | undefined): 'match' | 'mismatch' | 'missing' {
  if (!local && !external) return 'missing';
  if (!local || !external) return 'missing';
  if (local.toLowerCase().trim() === external.toLowerCase().trim()) return 'match';
  return 'mismatch';
}

const STATUS_STYLES = {
  match: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300',
  mismatch: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
  missing: 'bg-muted text-muted-foreground',
} as const;

function FieldCell({ value, status }: { value: string | null | undefined; status: 'match' | 'mismatch' | 'missing' }) {
  return (
    <div className={`rounded px-2 py-1 text-sm ${STATUS_STYLES[status]}`}>
      {value || '--'}
    </div>
  );
}

export function HintComparison({ localPerson, externalRecord }: HintComparisonProps) {
  const rows: FieldRow[] = [
    {
      label: 'Name',
      local: `${localPerson.givenName} ${localPerson.surname}`.trim(),
      external: externalRecord.name,
    },
    {
      label: 'Birth Date',
      local: localPerson.birthDate,
      external: externalRecord.birthDate,
    },
    {
      label: 'Birth Place',
      local: localPerson.birthPlace,
      external: externalRecord.birthPlace ?? externalRecord.location,
    },
    {
      label: 'Death Date',
      local: localPerson.deathDate,
      external: externalRecord.deathDate,
    },
    {
      label: 'Death Place',
      local: localPerson.deathPlace,
      external: externalRecord.deathPlace,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Your Tree</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => {
            const status = fieldStatus(row.local, row.external);
            return (
              <div key={row.label}>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">{row.label}</p>
                <FieldCell value={row.local} status={status} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">External Record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => {
            const status = fieldStatus(row.local, row.external);
            return (
              <div key={row.label}>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">{row.label}</p>
                <FieldCell value={row.external} status={status} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export type { PersonSummary, ExternalRecordData };
