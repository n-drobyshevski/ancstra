import { setRequestLocale } from 'next-intl/server';
import { listInboxItems, countInboxItems } from '@ancstra/research';
import type { InboxItemType } from '@ancstra/research';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { getFamilyDb } from '@/lib/db';
import { InboxEmpty } from '@/components/inbox/inbox-empty';
import { InboxList } from '@/components/inbox/inbox-list';
import type { Locale } from '@/i18n/routing';

const VALID_TYPES = new Set<InboxItemType>([
  'factsheet_draft',
  'ai_proposal',
  'conflict',
  'hint',
]);

export interface InboxSearchParams {
  type?: string;
  threadId?: string;
  personId?: string;
}

function parseTypeFilter(raw: string | undefined): InboxItemType | InboxItemType[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is InboxItemType => VALID_TYPES.has(s as InboxItemType));
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return parts;
}

interface InboxPageSectionProps {
  locale: Locale;
  searchParams: InboxSearchParams;
}

/**
 * Bundle B §3.2 — async data shell for `/inbox`.
 *
 * Calls `setRequestLocale` at the top of the section because Next.js 16's
 * cacheComponents-mode Layout `setRequestLocale` doesn't propagate through
 * Suspense boundaries (see feedback_setrequestlocale_propagation.md).
 *
 * Resolves auth via `requirePagePermission('ai:research')` (same gate as the
 * REST inbox routes) and reads the family DB via the canonical `getFamilyDb`
 * helper — mirrors `lib/research/thread-loaders.ts`.
 *
 * T16 wires data + empty-state only. The interactive filter UI + per-type
 * rows land in T17 by replacing the `<InboxList>` placeholder.
 */
export async function InboxPageSection({
  locale,
  searchParams,
}: InboxPageSectionProps) {
  setRequestLocale(locale);

  const ctx = await requirePagePermission('ai:research');
  const db = await getFamilyDb(ctx.dbFilename);

  const typeFilter = parseTypeFilter(searchParams.type);
  const threadFilter: string | 'untriaged' | undefined =
    searchParams.threadId === 'untriaged'
      ? 'untriaged'
      : searchParams.threadId || undefined;
  const personId = searchParams.personId || undefined;

  const [items, counts] = await Promise.all([
    listInboxItems(db, {
      type: typeFilter,
      threadId: threadFilter,
      personId,
      limit: 50,
    }),
    countInboxItems(db, { threadId: threadFilter, personId }),
  ]);

  if (counts.total === 0) {
    return <InboxEmpty locale={locale} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline gap-2">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <span className="text-muted-foreground">· {counts.total}</span>
      </header>
      <InboxList
        locale={locale}
        initialItems={items}
        initialCounts={counts}
        initialFilters={{
          type: typeFilter,
          threadId: threadFilter === 'untriaged' ? undefined : threadFilter,
          personId,
        }}
      />
    </div>
  );
}
