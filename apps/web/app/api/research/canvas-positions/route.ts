import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { researchCanvasPositions } from '@ancstra/db';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');
    if (!personId) {
      return NextResponse.json(
        { error: 'personId is required' },
        { status: 400 },
      );
    }

    const positions = await familyDb
      .select()
      .from(researchCanvasPositions)
      .where(eq(researchCanvasPositions.personId, personId))
      .all();

    return NextResponse.json({ positions });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[canvas-positions GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');

    const body = await request.json();
    const { personId, positions } = body;

    if (!personId || !Array.isArray(positions)) {
      return NextResponse.json(
        { error: 'personId and positions[] are required' },
        { status: 400 },
      );
    }

    type NodeType = 'research_item' | 'source' | 'note' | 'conflict';

    for (const pos of positions) {
      await familyDb.insert(researchCanvasPositions)
        .values({
          id: crypto.randomUUID(),
          personId,
          nodeType: pos.nodeType as NodeType,
          nodeId: pos.nodeId,
          x: pos.x,
          y: pos.y,
        })
        .onConflictDoUpdate({
          target: [
            researchCanvasPositions.personId,
            researchCanvasPositions.nodeType,
            researchCanvasPositions.nodeId,
          ],
          set: { x: pos.x, y: pos.y },
        })
        .run();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[canvas-positions PUT]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');
    const nodeId = searchParams.get('nodeId');
    const nodeType = searchParams.get('nodeType');

    if (!personId || !nodeId || !nodeType) {
      return NextResponse.json(
        { error: 'personId, nodeId, and nodeType are required' },
        { status: 400 },
      );
    }

    await familyDb.delete(researchCanvasPositions)
      .where(
        and(
          eq(researchCanvasPositions.personId, personId),
          eq(researchCanvasPositions.nodeId, nodeId),
          eq(researchCanvasPositions.nodeType, nodeType as 'research_item' | 'source' | 'note' | 'conflict'),
        ),
      )
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[canvas-positions DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
