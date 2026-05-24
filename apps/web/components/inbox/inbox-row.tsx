'use client';

import type { InboxItem } from '@ancstra/research';
import { InboxRowFactsheetDraft } from './inbox-row-factsheet-draft';
import { InboxRowAIProposal } from './inbox-row-ai-proposal';
import { InboxRowConflict } from './inbox-row-conflict';
import { InboxRowHint } from './inbox-row-hint';

export function InboxRow({ item, locale }: { item: InboxItem; locale: string }) {
  switch (item.type) {
    case 'factsheet_draft': return <InboxRowFactsheetDraft item={item} locale={locale} />;
    case 'ai_proposal':     return <InboxRowAIProposal item={item} locale={locale} />;
    case 'conflict':        return <InboxRowConflict item={item} locale={locale} />;
    case 'hint':            return <InboxRowHint item={item} locale={locale} />;
  }
}
