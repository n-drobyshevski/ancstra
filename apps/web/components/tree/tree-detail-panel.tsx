'use client';

import Link from 'next/link';
import type { PersonListItem, TreeData } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

interface TreeDetailPanelProps {
  person: PersonListItem;
  treeData: TreeData;
  onClose: () => void;
  onFocusNode: (personId: string) => void;
}

export function TreeDetailPanel({ person, treeData, onClose, onFocusNode }: TreeDetailPanelProps) {
  const { families, childLinks, persons } = treeData;
  const personMap = new Map(persons.map((p) => [p.id, p]));

  // Spouses
  const spouses: PersonListItem[] = [];
  for (const fam of families) {
    if (fam.partner1Id === person.id && fam.partner2Id) {
      const s = personMap.get(fam.partner2Id); if (s) spouses.push(s);
    } else if (fam.partner2Id === person.id && fam.partner1Id) {
      const s = personMap.get(fam.partner1Id); if (s) spouses.push(s);
    }
  }

  // Parents
  const parents: PersonListItem[] = [];
  const childFamIds = childLinks.filter((cl) => cl.personId === person.id).map((cl) => cl.familyId);
  for (const famId of childFamIds) {
    const fam = families.find((f) => f.id === famId);
    if (!fam) continue;
    if (fam.partner1Id) { const p = personMap.get(fam.partner1Id); if (p && !parents.some(e => e.id === p.id)) parents.push(p); }
    if (fam.partner2Id) { const p = personMap.get(fam.partner2Id); if (p && !parents.some(e => e.id === p.id)) parents.push(p); }
  }

  // Children
  const childrenList: PersonListItem[] = [];
  const partnerFamIds = families.filter((f) => f.partner1Id === person.id || f.partner2Id === person.id).map((f) => f.id);
  for (const famId of partnerFamIds) {
    for (const k of childLinks.filter((cl) => cl.familyId === famId)) {
      const c = personMap.get(k.personId);
      if (c && !childrenList.some((e) => e.id === c.id)) childrenList.push(c);
    }
  }

  function RelBtn({ p }: { p: PersonListItem }) {
    return (
      <button onClick={() => onFocusNode(p.id)} className="text-sm text-primary underline-offset-4 hover:underline text-left">
        {p.givenName} {p.surname}{p.birthDate ? ` (b. ${p.birthDate})` : ''}
      </button>
    );
  }

  return (
    <div className="w-[400px] shrink-0 border-l border-border bg-card overflow-y-auto">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-base font-semibold">{person.givenName} {person.surname}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">{sexLabel[person.sex]}</Badge>
            {person.isLiving && <Badge className="text-xs">Living</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close detail panel"><X className="size-4" /></Button>
      </div>

      <div className="border-b p-4 space-y-1 text-sm">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Vital Info</h3>
        {person.birthDate && <div>Birth: {person.birthDate}</div>}
        {person.deathDate && <div>Death: {person.deathDate}</div>}
        {!person.birthDate && !person.deathDate && <div className="text-muted-foreground">No dates recorded</div>}
      </div>

      <div className="border-b p-4 space-y-3 text-sm">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Family</h3>
        {spouses.length > 0 && <div><div className="text-muted-foreground text-xs mb-1">Spouses</div>{spouses.map((s) => <div key={s.id}><RelBtn p={s} /></div>)}</div>}
        {parents.length > 0 && <div><div className="text-muted-foreground text-xs mb-1">Parents</div>{parents.map((p) => <div key={p.id}><RelBtn p={p} /></div>)}</div>}
        {childrenList.length > 0 && <div><div className="text-muted-foreground text-xs mb-1">Children</div>{childrenList.map((c) => <div key={c.id}><RelBtn p={c} /></div>)}</div>}
        {spouses.length === 0 && parents.length === 0 && childrenList.length === 0 && <div className="text-muted-foreground">No relationships recorded</div>}
      </div>

      <div className="p-4 space-y-2">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/persons/${person.id}/edit`}>Edit Full Page</Link>
        </Button>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/persons/${person.id}`}>View Detail Page</Link>
        </Button>
      </div>
    </div>
  );
}
