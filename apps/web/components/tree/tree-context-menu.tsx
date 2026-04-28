'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { PersonListItem } from '@ancstra/shared';
import { toast } from 'sonner';
import { personDetailCache } from '@/lib/tree/person-detail-cache';
import type { RelationType } from '@/components/person-link-dialog';

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'node' | 'edge' | 'canvas';
  nodeId?: string;
  edgeId?: string;
  edgeType?: string;
  edgeFamilyId?: string;
  edgeChildId?: string;
  persons: PersonListItem[];
  onClose: () => void;
  onDeleteRelationship?: (edgeId: string) => void;
  /** Open the create-or-link dialog for a relation. The parent is responsible
   *  for actually mounting the dialog so it survives this menu being unmounted. */
  onAddRelation?: (
    kind: 'create' | 'link',
    relation: RelationType,
    target: { id: string; name: string; sex: 'M' | 'F' | 'U' },
  ) => void;
}

type MenuItem = {
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  separator?: boolean;
  header?: boolean;
  submenu?: MenuItem[];
};

const ADD_RELATION_GROUPS: Array<{ relation: RelationType; label: string }> = [
  { relation: 'spouse', label: 'Spouse' },
  { relation: 'father', label: 'Father' },
  { relation: 'mother', label: 'Mother' },
  { relation: 'child', label: 'Child' },
  { relation: 'sibling', label: 'Sibling' },
];

export function TreeContextMenu({
  x, y, type, nodeId, edgeId, persons, onClose, onDeleteRelationship, onAddRelation,
}: ContextMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current?.contains(target)) return;
      if (submenuRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const person = nodeId ? persons.find((p) => p.id === nodeId) : null;

  const requestAddRelation = useCallback(
    (kind: 'create' | 'link', relation: RelationType) => {
      if (!person || !nodeId || !onAddRelation) return;
      onAddRelation(kind, relation, {
        id: nodeId,
        name: `${person.givenName} ${person.surname}`,
        sex: person.sex,
      });
      onClose();
    },
    [person, nodeId, onAddRelation, onClose],
  );

  const items: MenuItem[] = [];

  if (type === 'node' && person) {
    items.push(
      { label: `${person.givenName} ${person.surname}`, header: true },
      { separator: true, label: '' },
      { label: 'View Details', onClick: () => onClose() },
      { label: 'Edit Person', onClick: () => { router.push(`/persons/${nodeId}?view=record`); onClose(); } },
      { label: 'Research this person', onClick: () => { router.push(`/persons/${nodeId}?view=board`); onClose(); } },
      { separator: true, label: '' },
      ...ADD_RELATION_GROUPS.map(({ relation, label }) => ({
        label: `Add ${label}`,
        submenu: [
          { label: 'Link existing', onClick: () => requestAddRelation('link', relation) },
          { label: '+ New', onClick: () => requestAddRelation('create', relation) },
        ],
      })),
      { separator: true, label: '' },
      {
        label: 'Delete Person', destructive: true,
        onClick: async () => {
          if (!confirm(`Delete ${person.givenName} ${person.surname}?`)) return;
          const res = await fetch(`/api/persons/${nodeId}`, { method: 'DELETE' });
          if (res.ok) {
            if (nodeId) personDetailCache.invalidate(nodeId);
            toast.success('Person deleted'); router.refresh();
          } else toast.error('Failed to delete');
          onClose();
        },
      },
    );
  } else if (type === 'edge') {
    items.push({
      label: 'Delete Relationship', destructive: true,
      onClick: () => {
        if (edgeId && onDeleteRelationship) onDeleteRelationship(edgeId);
        onClose();
      },
    });
  } else if (type === 'canvas') {
    items.push(
      { label: 'Add Person', onClick: () => { router.push('/persons/new'); onClose(); } },
      { label: 'Fit View', onClick: () => onClose() },
    );
  }

  if (items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg border bg-popover p-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if (item.separator) return <div key={i} className="my-1 h-px bg-border" />;
        if (item.header) return (
          <div key={i} className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.label}
          </div>
        );
        if (item.submenu) {
          const isOpen = openSubmenu === i;
          return (
            <div
              key={i}
              className="relative"
              onMouseEnter={() => setOpenSubmenu(i)}
              onMouseLeave={() => setOpenSubmenu((cur) => (cur === i ? null : cur))}
            >
              <button
                type="button"
                className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between"
              >
                <span>{item.label}</span>
                <span className="ml-2 text-muted-foreground">›</span>
              </button>
              {isOpen && (
                <div
                  ref={submenuRef}
                  className="absolute left-full top-0 ml-1 min-w-[150px] rounded-lg border bg-popover p-1 shadow-lg"
                >
                  {item.submenu.map((sub, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={sub.onClick}
                      className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={item.onClick}
            className={`w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent ${item.destructive ? 'text-destructive hover:bg-destructive/10' : ''}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
