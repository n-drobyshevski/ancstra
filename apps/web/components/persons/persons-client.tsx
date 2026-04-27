'use client';

import { PersonsShell } from './persons-shell';
import type { PersonListItem } from '@ancstra/shared';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

interface PersonsClientProps {
  initialPersons: PersonListItem[];
  initialTotal: number;
  yearBounds: TreeYearBounds;
}

export function PersonsClient(props: PersonsClientProps) {
  return <PersonsShell {...props} />;
}
