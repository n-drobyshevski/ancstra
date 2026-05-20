export type ThreadStatus = 'active' | 'paused' | 'resolved' | 'abandoned';

export type ThreadEventType =
  | 'thread_started' | 'item_attached' | 'fact_extracted'
  | 'factsheet_created' | 'factsheet_linked' | 'mention_followed'
  | 'mention_extracted'
  | 'conflict_resolved' | 'duplicate_resolved' | 'factsheet_promoted'
  | 'relationship_proposed'
  | 'note_added' | 'thread_paused' | 'thread_resolved' | 'thread_abandoned';

export interface CreateThreadInput {
  title: string;
  seedPersonId?: string;
  seedFactsheetId?: string;
  seedResearchItemId?: string;
  summary?: string;
  createdBy: string;
}

export interface UpdateThreadInput {
  title?: string;
  summary?: string;
}

export interface AddEventInput {
  threadId: string;
  eventType: ThreadEventType;
  actorId: string;
  factsheetId?: string;
  personId?: string;
  researchItemId?: string;
  researchFactId?: string;
  sourceId?: string;
  linkId?: string;
  reason?: string;
  payload?: unknown;
}

export interface ListThreadsFilters {
  status?: ThreadStatus;
  createdBy?: string;
  /**
   * Case-insensitive substring match against thread title.
   * Matched server-side with LOWER(title) LIKE %q% to keep the list
   * page from doing an O(n) JS scan on every keystroke.
   */
  q?: string;
}

export interface ThreadTimelineCursor {
  occurredAt: string;
  id: string;
}

export interface ThreadTimelinePage<E> {
  events: E[];
  nextCursor: ThreadTimelineCursor | null;
}

export interface ListPersonsTouchedOptions {
  /** Max rows to return. Default 200. */
  limit?: number;
  /** Cursor: person id to start AFTER (lexical). */
  after?: string;
}
