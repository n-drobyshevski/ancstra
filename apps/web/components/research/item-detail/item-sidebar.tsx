'use client';

interface ItemSidebarProps {
  item: {
    id: string;
    providerId: string | null;
    discoveryMethod: string;
    searchQuery: string | null;
    archivedAt: string | null;
    url: string | null;
    createdAt: string;
    updatedAt: string;
    personIds: string[];
  };
}

export function ItemSidebar({ item }: ItemSidebarProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Sidebar — implemented in next task</p>
      </div>
    </div>
  );
}
