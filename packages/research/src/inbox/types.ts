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
