'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { PersonListItem } from '@ancstra/shared';
import { toast } from 'sonner';

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
}

export function TreeContextMenu({ x, y, type, nodeId, edgeId, edgeType, edgeFamilyId, edgeChildId, persons, onClose }: ContextMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const person = nodeId ? persons.find((p) => p.id === nodeId) : null;

  type MenuItem = { label: string; onClick: () => void; destructive?: boolean; separator?: boolean; header?: boolean };
  const items: MenuItem[] = [];

  if (type === 'node' && person) {
    items.push(
      { label: `${person.givenName} ${person.surname}`, onClick: () => {}, header: true },
      { label: '', onClick: () => {}, separator: true },
      { label: 'View Details', onClick: () => onClose() },
      { label: 'Edit Person', onClick: () => { router.push(`/person/${nodeId}/edit`); onClose(); } },
      { label: 'Research this person', onClick: () => { router.push(`/research/person/${nodeId}`); onClose(); } },
      { label: '', onClick: () => {}, separator: true },
      { label: '+ Add Spouse', onClick: () => { router.push(`/person/new?relation=spouse&of=${nodeId}`); onClose(); } },
      { label: '+ Add Father', onClick: () => { router.push(`/person/new?relation=father&of=${nodeId}`); onClose(); } },
      { label: '+ Add Mother', onClick: () => { router.push(`/person/new?relation=mother&of=${nodeId}`); onClose(); } },
      { label: '+ Add Child', onClick: () => { router.push(`/person/new?relation=child&of=${nodeId}`); onClose(); } },
      { label: '', onClick: () => {}, separator: true },
      {
        label: 'Delete Person', destructive: true,
        onClick: async () => {
          if (!confirm(`Delete ${person.givenName} ${person.surname}?`)) return;
          const res = await fetch(`/api/persons/${nodeId}`, { method: 'DELETE' });
          if (res.ok) { toast.success('Person deleted'); router.refresh(); }
          else toast.error('Failed to delete');
          onClose();
        },
      },
    );
  } else if (type === 'edge') {
    items.push({
      label: 'Delete Relationship', destructive: true,
      onClick: async () => {
        try {
          if (edgeType === 'partner' && edgeFamilyId) {
            const res = await fetch(`/api/families/${edgeFamilyId}`, { method: 'DELETE' });
            if (!res.ok) { toast.error('Failed to delete relationship'); onClose(); return; }
          } else if (edgeType === 'parentChild' && edgeFamilyId && edgeChildId) {
            const res = await fetch(`/api/families/${edgeFamilyId}/children/${edgeChildId}`, { method: 'DELETE' });
            if (!res.ok) { toast.error('Failed to unlink child'); onClose(); return; }
          } else {
            toast.error('Cannot determine relationship type');
            onClose();
            return;
          }
          toast.success('Relationship deleted');
          router.refresh();
        } catch { toast.error('Network error'); }
        onClose();
      },
    });
  } else if (type === 'canvas') {
    items.push(
      { label: 'Add Person', onClick: () => { router.push('/person/new'); onClose(); } },
      { label: 'Fit View', onClick: () => onClose() },
    );
  }

  if (items.length === 0) return null;

  return (
    <div ref={menuRef} className="fixed z-50 min-w-[180px] rounded-lg border bg-popover p-1 shadow-lg" style={{ left: x, top: y }}>
      {items.map((item, i) => {
        if (item.separator) return <div key={i} className="my-1 h-px bg-border" />;
        if (item.header) return (
          <div key={i} className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.label}
          </div>
        );
        return (
          <button key={i} onClick={item.onClick}
            className={`w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent ${item.destructive ? 'text-destructive hover:bg-destructive/10' : ''}`}>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
