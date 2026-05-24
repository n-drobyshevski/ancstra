import { sql } from 'drizzle-orm';
import type { Database, Confidence } from '@ancstra/db';
import type {
  InboxItem, InboxItemType, InboxFilters, InboxCounts,
  FactsheetDraftItem, AIProposalItem, ConflictItem, HintItem,
} from './types';

/**
 * Bundle B 2026-05-24 — Inbox aggregation across four sources.
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-b-design.md §2
 *
 * Strategy: one query per source, in-memory merge + sort + paginate.
 * At family-DB scale (single user, low-thousands rows max) the cost is
 * negligible; readability wins over quadruple-JOIN megaquery.
 */

const ALL_TYPES: InboxItemType[] = ['factsheet_draft', 'ai_proposal', 'conflict', 'hint'];

function normalizeTypes(t?: InboxItemType | InboxItemType[]): Set<InboxItemType> {
  if (!t) return new Set(ALL_TYPES);
  return new Set(Array.isArray(t) ? t : [t]);
}

export async function listInboxItems(
  db: Database,
  filters?: InboxFilters,
): Promise<InboxItem[]> {
  const allowedTypes = normalizeTypes(filters?.type);

  const tasks: Promise<InboxItem[]>[] = [];
  if (allowedTypes.has('factsheet_draft')) tasks.push(queryFactsheetDrafts(db, filters));
  if (allowedTypes.has('ai_proposal'))    tasks.push(queryAIProposals(db, filters));
  if (allowedTypes.has('conflict'))       tasks.push(queryConflicts(db, filters));
  if (allowedTypes.has('hint'))           tasks.push(queryHints(db, filters));

  const groups = await Promise.all(tasks);
  const merged = groups.flat();
  merged.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));

  const offset = filters?.offset ?? 0;
  const limit = filters?.limit ?? 50;
  return merged.slice(offset, offset + limit);
}

export async function countInboxItems(
  db: Database,
  filters?: Pick<InboxFilters, 'threadId' | 'personId'>,
): Promise<InboxCounts> {
  const [drafts, proposals, conflicts, hints] = await Promise.all([
    queryFactsheetDrafts(db, filters).then(rs => rs.length),
    queryAIProposals(db, filters).then(rs => rs.length),
    queryConflicts(db, filters).then(rs => rs.length),
    queryHints(db, filters).then(rs => rs.length),
  ]);
  return {
    total: drafts + proposals + conflicts + hints,
    byType: {
      factsheet_draft: drafts,
      ai_proposal: proposals,
      conflict: conflicts,
      hint: hints,
    },
  };
}

async function queryFactsheetDrafts(
  db: Database,
  filters?: InboxFilters,
): Promise<FactsheetDraftItem[]> {
  const rows = await db.all<{
    id: string; title: string; status: string; entity_type: string;
    created_thread_id: string | null; thread_title: string | null;
    created_at: string; updated_at: string; fact_count: number;
  }>(sql`
    SELECT fs.id, fs.title, fs.status, fs.entity_type,
           fs.created_thread_id, t.title AS thread_title,
           fs.created_at, fs.updated_at,
           (SELECT COUNT(*) FROM research_facts rf WHERE rf.factsheet_id = fs.id) AS fact_count
    FROM factsheets fs
    LEFT JOIN research_threads t ON t.id = fs.created_thread_id
    WHERE fs.status IN ('draft', 'ready')
      AND fs.entity_type IN ('person', 'couple')
  `);

  return rows
    .filter(r => matchThread(r.created_thread_id, filters?.threadId))
    .filter(() => !filters?.personId)
    .map(r => ({
      id: `factsheet_draft:${r.id}`,
      type: 'factsheet_draft' as const,
      entityId: r.id,
      title: r.title,
      subtitle: `${r.fact_count} fact${r.fact_count === 1 ? '' : 's'} · ${r.status}`,
      threadId: r.created_thread_id,
      threadTitle: r.thread_title,
      personId: null,
      personName: null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      factsheetStatus: r.status as 'draft' | 'ready',
      factCount: Number(r.fact_count),
      entityType: r.entity_type as 'person' | 'couple',
    }));
}

async function queryAIProposals(
  db: Database,
  filters?: InboxFilters,
): Promise<AIProposalItem[]> {
  const rows = await db.all<{
    id: string; title: string; created_thread_id: string | null; thread_title: string | null;
    created_at: string; updated_at: string;
    fact_type: string; fact_value: string; confidence: string;
    person_id: string | null; given_name: string | null; surname: string | null;
  }>(sql`
    SELECT fs.id, fs.title, fs.created_thread_id, t.title AS thread_title,
           fs.created_at, fs.updated_at,
           rf.fact_type, rf.fact_value, rf.confidence,
           rf.person_id, pn.given_name, pn.surname
    FROM factsheets fs
    LEFT JOIN research_threads t ON t.id = fs.created_thread_id
    LEFT JOIN research_facts rf ON rf.factsheet_id = fs.id
    LEFT JOIN person_names pn ON pn.person_id = rf.person_id AND pn.is_primary = 1
    WHERE fs.status = 'draft' AND fs.entity_type = 'family_unit'
  `);

  return rows
    .filter(r => matchThread(r.created_thread_id, filters?.threadId))
    .filter(r => !filters?.personId || r.person_id === filters.personId)
    .map(r => {
      const factTypeToRel: Record<string, AIProposalItem['relationshipType']> = {
        parent_name: 'parent_child',
        spouse_name: 'partner',
        sibling_name: 'sibling',
      };
      const rel = factTypeToRel[r.fact_type] ?? 'partner';
      const name1 = [r.given_name, r.surname].filter(Boolean).join(' ') || (r.person_id ?? 'someone');
      const otherId = r.fact_value;
      return {
        id: `ai_proposal:${r.id}`,
        type: 'ai_proposal' as const,
        entityId: r.id,
        title: r.title,
        subtitle: `AI-proposed ${rel} · confidence ${r.confidence}`,
        threadId: r.created_thread_id,
        threadTitle: r.thread_title,
        personId: r.person_id,
        personName: name1 || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        relationshipType: rel,
        confidence: r.confidence as Confidence,
        otherPersonId: otherId,
        otherPersonName: null,
      };
    });
}

async function queryConflicts(
  db: Database,
  filters?: InboxFilters,
): Promise<ConflictItem[]> {
  const rows = await db.all<{
    rf_id: string; person_id: string; fact_type: string;
    accepted_value: string | null;
    unresolved_concat: string | null;
    unresolved_count: number;
    given_name: string | null; surname: string | null;
    created_at: string; updated_at: string;
  }>(sql`
    SELECT
      rf_pending.id AS rf_id,
      rf_pending.person_id,
      rf_pending.fact_type,
      MAX(rf_accepted.fact_value) AS accepted_value,
      GROUP_CONCAT(rf_unres.fact_value, '|') AS unresolved_concat,
      COUNT(DISTINCT rf_unres.id) AS unresolved_count,
      pn.given_name, pn.surname,
      MIN(rf_pending.created_at) AS created_at,
      MAX(rf_pending.updated_at) AS updated_at
    FROM research_facts rf_pending
    JOIN research_facts rf_accepted
      ON rf_accepted.person_id = rf_pending.person_id
      AND rf_accepted.fact_type = rf_pending.fact_type
      AND rf_accepted.accepted = 1
    JOIN research_facts rf_unres
      ON rf_unres.person_id = rf_pending.person_id
      AND rf_unres.fact_type = rf_pending.fact_type
      AND rf_unres.accepted IS NULL
    LEFT JOIN person_names pn ON pn.person_id = rf_pending.person_id AND pn.is_primary = 1
    WHERE rf_pending.accepted IS NULL
    GROUP BY rf_pending.id, rf_pending.person_id, rf_pending.fact_type
  `);

  // Conflicts have no thread association — exclude when a specific thread is requested.
  // 'untriaged' (null thread) still matches since conflicts are inherently untriaged.
  if (filters?.threadId && filters.threadId !== 'untriaged') return [];

  return rows
    .filter(r => !filters?.personId || r.person_id === filters.personId)
    .map(r => ({
      id: `conflict:${r.rf_id}`,
      type: 'conflict' as const,
      entityId: r.rf_id,
      title: `${r.fact_type.replace(/_/g, ' ')} disagreement`,
      subtitle: `${r.unresolved_count} unresolved candidate${r.unresolved_count === 1 ? '' : 's'}`,
      threadId: null,
      threadTitle: null,
      personId: r.person_id,
      personName: [r.given_name, r.surname].filter(Boolean).join(' ') || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      factType: r.fact_type,
      competingFactCount: r.unresolved_count + 1,
      acceptedValue: r.accepted_value,
      unresolvedValues: (r.unresolved_concat ?? '').split('|').filter(Boolean),
    }));
}

async function queryHints(
  db: Database,
  filters?: InboxFilters,
): Promise<HintItem[]> {
  const rows = await db.all<{
    id: string; person_id: string; source_system: string; external_id: string;
    external_data: string; match_score: number;
    given_name: string | null; surname: string | null;
    created_at: string;
  }>(sql`
    SELECT mc.id, mc.person_id, mc.source_system, mc.external_id,
           mc.external_data, mc.match_score,
           pn.given_name, pn.surname,
           mc.created_at
    FROM match_candidates mc
    LEFT JOIN person_names pn ON pn.person_id = mc.person_id AND pn.is_primary = 1
    WHERE mc.match_status = 'pending'
  `);

  // Hints have no thread association — exclude when a specific thread is requested.
  // 'untriaged' (null thread) still matches since hints are inherently untriaged.
  if (filters?.threadId && filters.threadId !== 'untriaged') return [];

  return rows
    .filter(r => !filters?.personId || r.person_id === filters.personId)
    .map(r => {
      let label = r.external_id;
      try {
        const parsed = JSON.parse(r.external_data) as { name?: string; label?: string };
        label = parsed.name || parsed.label || r.external_id;
      } catch { /* keep external_id */ }
      const personName = [r.given_name, r.surname].filter(Boolean).join(' ') || null;
      return {
        id: `hint:${r.id}`,
        type: 'hint' as const,
        entityId: r.id,
        title: `Hint for ${personName ?? r.person_id}`,
        subtitle: `${r.source_system} · score ${r.match_score.toFixed(2)}`,
        threadId: null,
        threadTitle: null,
        personId: r.person_id,
        personName,
        createdAt: r.created_at,
        updatedAt: r.created_at,
        sourceSystem: r.source_system,
        matchScore: r.match_score,
        externalLabel: label,
      };
    });
}

function matchThread(
  rowThreadId: string | null,
  filter?: string | 'untriaged' | null,
): boolean {
  if (!filter) return true;
  if (filter === 'untriaged') return rowThreadId === null;
  return rowThreadId === filter;
}
