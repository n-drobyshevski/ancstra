'use client';

interface FactsheetsTabProps {
  personId: string;
}

export function FactsheetsTab({ personId }: FactsheetsTabProps) {
  return <div className="text-sm text-muted-foreground p-4">Factsheets tab for {personId}</div>;
}
