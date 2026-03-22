import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import { createResearchItem, tagPersonToItem } from '@ancstra/research';
import { z } from 'zod';

const requestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(50000, 'Text exceeds 50,000 character limit'),
  personId: z.string().optional(),
  documentType: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { text, personId, documentType } = parsed.data;

  try {
    // Generate a title from the first line or first 80 chars
    const firstLine = text.split('\n')[0]?.trim() ?? '';
    const title = firstLine.length > 80
      ? firstLine.slice(0, 77) + '...'
      : firstLine || (documentType ? `Pasted ${documentType}` : 'Pasted text');

    // Create a snippet from the first 300 chars
    const snippet = text.length > 300 ? text.slice(0, 297) + '...' : text;

    const db = createDb();
    const item = createResearchItem(db, {
      title,
      snippet,
      fullText: text,
      discoveryMethod: 'paste_text',
      notes: documentType ? `Document type: ${documentType}` : undefined,
      createdBy: session.user.id!,
    });

    // Tag person if provided
    if (personId) {
      tagPersonToItem(db, item.id, personId);
    }

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[research/paste POST]', err);
    return NextResponse.json({ error: 'Failed to save text' }, { status: 500 });
  }
}
