import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { createResearchItem, tagPersonToItem } from '@ancstra/research';
import { z } from 'zod';

const requestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(50000, 'Text exceeds 50,000 character limit'),
  personId: z.string().optional(),
  documentType: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('ai:research');

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { text, personId, documentType } = parsed.data;

    // Generate a title from the first line or first 80 chars
    const firstLine = text.split('\n')[0]?.trim() ?? '';
    const title = firstLine.length > 80
      ? firstLine.slice(0, 77) + '...'
      : firstLine || (documentType ? `Pasted ${documentType}` : 'Pasted text');

    // Create a snippet from the first 300 chars
    const snippet = text.length > 300 ? text.slice(0, 297) + '...' : text;

    const item = await createResearchItem(familyDb, {
      title,
      snippet,
      fullText: text,
      discoveryMethod: 'paste_text',
      notes: documentType ? `Document type: ${documentType}` : undefined,
      createdBy: ctx.userId,
    });

    // Tag person if provided
    if (personId) {
      tagPersonToItem(familyDb, item.id, personId);
    }

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/paste POST]', err);
    return NextResponse.json({ error: 'Failed to save text' }, { status: 500 });
  }
}
