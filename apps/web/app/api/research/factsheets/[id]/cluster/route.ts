/**
 * Bundle D 2026-05-25 — GET cluster membership + member list + edge count.
 *
 * Used by the factsheet-detail client component to branch the action menu
 * and pre-populate the ClusterUnmergeDialog.
 *
 * See: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §6.2
 */

import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  getClusterMembership,
  getClusterMembers,
  getClusterEdgeCount,
} from '@ancstra/research';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await params;

    const membership = await getClusterMembership(familyDb, id);

    if (membership.kind === 'no') {
      return NextResponse.json({ membership, members: [], edgeCount: { families: 0, children: 0 } });
    }

    if (membership.kind === 'legacy') {
      return NextResponse.json({ membership, members: [], edgeCount: { families: 0, children: 0 } });
    }

    // precise — fetch member list and edge counts
    const [members, edgeCount] = await Promise.all([
      getClusterMembers(familyDb, membership.clusterPromotionId),
      getClusterEdgeCount(familyDb, membership.clusterPromotionId),
    ]);

    return NextResponse.json({ membership, members, edgeCount });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/cluster GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
