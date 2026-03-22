'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TreeToolbarProps {
  onAutoLayout: () => void;
  onSaveLayout: () => void;
}

export function TreeToolbar({ onAutoLayout, onSaveLayout }: TreeToolbarProps) {
  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex justify-between pointer-events-none">
      <div className="flex gap-1.5 pointer-events-auto">
        <Button variant="secondary" size="sm" className="shadow-sm" onClick={onAutoLayout}>
          Auto Layout
        </Button>
        <Button variant="secondary" size="sm" className="shadow-sm" onClick={onSaveLayout}>
          Save Layout
        </Button>
        <Button size="sm" className="shadow-sm" asChild>
          <Link href="/person/new">+ New Person</Link>
        </Button>
      </div>
      <div className="flex gap-1.5 pointer-events-auto">
        <Button variant="secondary" size="sm" className="shadow-sm" disabled>
          Search
        </Button>
        <Button variant="secondary" size="sm" className="shadow-sm" disabled>
          Filter
        </Button>
        <Button variant="secondary" size="sm" className="shadow-sm" disabled>
          Export
        </Button>
      </div>
    </div>
  );
}
