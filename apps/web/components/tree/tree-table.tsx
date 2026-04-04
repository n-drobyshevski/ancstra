'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { TreeData, PersonListItem } from '@ancstra/shared';
import type { FilterState } from './tree-utils';
import { TreePersonCard } from './tree-person-card';

type SortKey = 'name' | 'birthDate' | 'deathDate' | 'birthPlace' | 'sex' | 'childCount';
type SortDir = 'ascending' | 'descending';

interface TreeTableProps {
  treeData: TreeData;
  relationships: {
    parents: Record<string, { id: string; name: string }[]>;
    spouses: Record<string, { id: string; name: string }[]>;
  };
  onSelectPerson: (personId: string) => void;
  filterState?: FilterState;
}

function getChildCount(personId: string, treeData: TreeData): number {
  const familyIds = treeData.families
    .filter((f) => f.partner1Id === personId || f.partner2Id === personId)
    .map((f) => f.id);
  return treeData.childLinks.filter((cl) => familyIds.includes(cl.familyId)).length;
}

export function TreeTable({ treeData, relationships, onSelectPerson, filterState }: TreeTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('ascending');
  const [search, setSearch] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'ascending' ? 'descending' : 'ascending'));
    } else {
      setSortKey(key);
      setSortDir('ascending');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === 'ascending' ? ' \u2191' : ' \u2193';
  };

  const filtered = useMemo(() => {
    let result = treeData.persons;

    // Apply text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.givenName.toLowerCase().includes(q) ||
          p.surname.toLowerCase().includes(q),
      );
    }

    // Apply toolbar filters
    if (filterState) {
      result = result.filter((p) => {
        const sexVisible = filterState.sex[p.sex as 'M' | 'F' | 'U'] ?? true;
        const livingVisible = p.isLiving
          ? filterState.living.living
          : filterState.living.deceased;
        return sexVisible && livingVisible;
      });
    }

    return result;
  }, [treeData.persons, search, filterState]);

  const sorted = useMemo(() => {
    const mult = sortDir === 'ascending' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name': {
          const cmp = `${a.surname} ${a.givenName}`.localeCompare(
            `${b.surname} ${b.givenName}`,
          );
          return cmp * mult;
        }
        case 'birthDate': {
          const aSort = (a as PersonListItem & Record<string, unknown>).birthDateSort ?? 0;
          const bSort = (b as PersonListItem & Record<string, unknown>).birthDateSort ?? 0;
          return ((aSort as number) - (bSort as number)) * mult;
        }
        case 'deathDate': {
          const aSort = (a as PersonListItem & Record<string, unknown>).deathDateSort ?? 0;
          const bSort = (b as PersonListItem & Record<string, unknown>).deathDateSort ?? 0;
          return ((aSort as number) - (bSort as number)) * mult;
        }
        case 'birthPlace': {
          const aPlace = ((a as PersonListItem & Record<string, unknown>).birthPlace ?? '') as string;
          const bPlace = ((b as PersonListItem & Record<string, unknown>).birthPlace ?? '') as string;
          return aPlace.localeCompare(bPlace) * mult;
        }
        case 'sex':
          return a.sex.localeCompare(b.sex) * mult;
        case 'childCount': {
          const ac = getChildCount(a.id, treeData);
          const bc = getChildCount(b.id, treeData);
          return (ac - bc) * mult;
        }
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortDir, treeData]);

  if (treeData.persons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">No persons in your tree yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-4 px-3 py-2 border-b">
        <Input
          placeholder="Filter by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          aria-label="Filter persons by name"
        />
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:flex flex-1 overflow-auto">
        <Table role="table">
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                aria-sort={sortKey === 'name' ? sortDir : undefined}
                onClick={() => handleSort('name')}
              >
                Name{sortIndicator('name')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                aria-sort={sortKey === 'birthDate' ? sortDir : undefined}
                onClick={() => handleSort('birthDate')}
              >
                Birth Date{sortIndicator('birthDate')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                aria-sort={sortKey === 'deathDate' ? sortDir : undefined}
                onClick={() => handleSort('deathDate')}
              >
                Death Date{sortIndicator('deathDate')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                aria-sort={sortKey === 'birthPlace' ? sortDir : undefined}
                onClick={() => handleSort('birthPlace')}
              >
                Birth Place{sortIndicator('birthPlace')}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                aria-sort={sortKey === 'sex' ? sortDir : undefined}
                onClick={() => handleSort('sex')}
              >
                Sex{sortIndicator('sex')}
              </TableHead>
              <TableHead>Parents</TableHead>
              <TableHead>Spouses</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                aria-sort={sortKey === 'childCount' ? sortDir : undefined}
                onClick={() => handleSort('childCount')}
              >
                Children{sortIndicator('childCount')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No persons match your filter.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((person) => {
                const parents = relationships.parents[person.id] ?? [];
                const spouses = relationships.spouses[person.id] ?? [];
                const childCount = getChildCount(person.id, treeData);

                return (
                  <TableRow
                    key={person.id}
                    tabIndex={0}
                    className="cursor-pointer"
                    aria-label={`${person.givenName} ${person.surname}`}
                    onClick={() => onSelectPerson(person.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSelectPerson(person.id);
                    }}
                  >
                    <TableCell className="font-medium">
                      {person.givenName} {person.surname}
                    </TableCell>
                    <TableCell>{person.birthDate ?? ''}</TableCell>
                    <TableCell>{person.deathDate ?? ''}</TableCell>
                    <TableCell>{((person as PersonListItem & Record<string, unknown>).birthPlace as string | null | undefined) ?? ''}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{person.sex}</Badge>
                    </TableCell>
                    <TableCell>
                      {parents.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && ', '}
                          <button
                            type="button"
                            className="text-primary underline hover:no-underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPerson(p.id);
                            }}
                          >
                            {p.name}
                          </button>
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>
                      {spouses.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && ', '}
                          <button
                            type="button"
                            className="text-primary underline hover:no-underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPerson(s.id);
                            }}
                          >
                            {s.name}
                          </button>
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>{childCount}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card list */}
      <div className="flex-1 overflow-auto md:hidden" role="list" aria-label="People in your family tree">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground text-sm">No persons match your filter.</p>
          </div>
        ) : (
          sorted.map((person) => (
            <TreePersonCard
              key={person.id}
              person={person}
              birthPlace={((person as PersonListItem & Record<string, unknown>).birthPlace as string | null | undefined) ?? undefined}
              onSelect={() => onSelectPerson(person.id)}
            />
          ))
        )}
      </div>

      <div className="p-3 border-t text-sm text-muted-foreground">
        {sorted.length} of {treeData.persons.length} person{treeData.persons.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
