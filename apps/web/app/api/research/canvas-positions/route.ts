import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, researchCanvasPositions } from '@ancstra/db';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');
    if (!personId) {
      return NextResponse.json(
        { error: 'personId is required' },
        { status: 400 },
      );
    }

    const db = createDb();
    const positions = db
      .select()
      .from(researchCanvasPositions)
      .where(eq(researchCanvasPositions.personId, personId))
      .all();

    return NextResponse.json({ positions });
  } catch (err) {
    console.error('[canvas-positions GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { personId, positions } = body;

    if (!personId || !Array.isArray(positions)) {
      return NextResponse.json(
        { error: 'personId and positions[] are required' },
        { status: 400 },
      );
    }

    const db = createDb();

    type NodeType = 'research_item' | 'source' | 'note' | 'conflict';

    for (const pos of positions) {
      db.insert(researchCanvasPositions)
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
    console.error('[canvas-positions PUT]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const db = createDb();
    db.delete(researchCanvasPositions)
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
    console.error('[canvas-positions DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
