import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import { promoteToSource } from '@ancstra/research';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { researchItemId?: string; personId?: string; citationText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.researchItemId || !body.personId) {
    return NextResponse.json(
      { error: 'researchItemId and personId are required' },
      { status: 400 },
    );
  }

  const db = createDb();

  try {
    const result = promoteToSource(db, {
      researchItemId: body.researchItemId,
      personId: body.personId,
      userId: session.user.id!,
      citationText: body.citationText,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const message: string = err?.message ?? 'Unknown error';

    if (/not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (/already promoted/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
