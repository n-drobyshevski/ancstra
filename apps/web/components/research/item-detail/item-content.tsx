'use client';

interface ItemContentProps {
  item: {
    snippet: string | null;
    fullText: string | null;
    notes: string | null;
    id: string;
    url: string | null;
  };
  onNotesChange: (notes: string) => void;
}

export function ItemContent({ item }: ItemContentProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Content — implemented in next task</p>
      </div>
    </div>
  );
}
