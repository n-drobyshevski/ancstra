/**
 * Bundle B 2026-05-24 — Inbox aggregation types.
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-b-design.md §2.2
 */

import type { Confidence } from '@ancstra/db';

export type InboxItemType =
  | 'factsheet_draft'
  | 'ai_proposal'
  | 'conflict'
  | 'hint';

export interface InboxItemBase {
  id: string;                       // synthetic: `${type}:${entityId}`
  type: InboxItemType;
  entityId: string;
  title: string;
  subtitle: string;
  threadId: string | null;
  threadTitle: string | null;
  personId: string | null;
  personName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FactsheetDraftItem extends InboxItemBase {
  type: 'factsheet_draft';
  factsheetStatus: 'draft' | 'ready';
  factCount: number;
  entityType: 'person' | 'couple';
  /**
   * Bundle D 2026-05-25: set when the factsheet was recently returned to
   * ready/draft status via a cluster unmerge. Value is the clusterUnmergeId
   * from the most recent `factsheet_unmerged` audit event with that field in
   * its payload. Used by the inbox row to render a "Cluster member" badge.
   * NULL for solo unmerged or non-unmerged factsheets.
   */
  clusterUnmergeId: string | null;
}

export interface AIProposalItem extends InboxItemBase {
  type: 'ai_proposal';
  relationshipType: 'parent_child' | 'spouse' | 'partner' | 'sibling';
  confidence: Confidence;
  otherPersonId: string;
  otherPersonName: string | null;
}

export interface ConflictItem extends InboxItemBase {
  type: 'conflict';
  factType: string;
  competingFactCount: number;
  acceptedValue: string | null;
  unresolvedValues: string[];
}

export interface HintItem extends InboxItemBase {
  type: 'hint';
  sourceSystem: string;
  matchScore: number;
  externalLabel: string;
}

export type InboxItem =
  | FactsheetDraftItem
  | AIProposalItem
  | ConflictItem
  | HintItem;

export interface InboxFilters {
  type?: InboxItemType | InboxItemType[];
  threadId?: string | 'untriaged' | null;
  personId?: string;
  limit?: number;
  offset?: number;
}

export interface InboxCounts {
  total: number;
  byType: Record<InboxItemType, number>;
}
