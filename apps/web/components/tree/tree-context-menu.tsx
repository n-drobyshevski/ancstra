'use client';

import type { PersonListItem } from '@ancstra/shared';

export function TreeContextMenu(props: {
  x: number;
  y: number;
  type: string;
  nodeId?: string;
  edgeId?: string;
  persons: PersonListItem[];
  onClose: () => void;
}) {
  return null;
}
