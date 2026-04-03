import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
// TODO: Install dependencies before enabling AI extraction:
//   pnpm add ai @ai-sdk/anthropic
// import { generateObject } from 'ai';
// import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod/v3';

const factSchema = z.object({
  facts: z.array(z.object({
    factType: z.enum(['name', 'birth_date', 'birth_place', 'death_date', 'death_place',
      'marriage_date', 'marriage_place', 'residence', 'occupation', 'immigration',
      'military_service', 'religion', 'ethnicity', 'parent_name', 'spouse_name', 'child_name', 'other']),
    factValue: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
});

export type ExtractedFact = z.infer<typeof factSchema>['facts'][number];

const requestSchema = z.object({
  text: z.string().min(1, 'text is required'),
  personContext: z.string().optional(),
  documentType: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await withAuth('ai:research');

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { text, personContext, documentType } = parsed.data;

    const systemPrompt = `You are a genealogy research assistant that extracts structured facts from historical documents and text.
Extract all genealogical facts you can find. For each fact, determine:
- factType: the category of the fact
- factValue: the actual value (dates in YYYY-MM-DD format when possible, places as complete as found)
- confidence: "high" if explicitly stated, "medium" if reasonably inferred, "low" if uncertain`;

    const userPrompt = [
      `Extract genealogical facts from the following text:`,
      documentType ? `\nDocument type: ${documentType}` : '',
      personContext ? `\nPerson context: ${personContext}` : '',
      `\nText:\n${text}`,
    ].join('');

    try {
      // TODO: Uncomment when ai and @ai-sdk/anthropic are installed
      // const result = await generateObject({
      //   model: anthropic('claude-sonnet-4-20250514'),
      //   schema: factSchema,
      //   system: systemPrompt,
      //   prompt: userPrompt,
      // });
      // return NextResponse.json(result.object);

      // Temporary stub until AI SDK is installed
      return NextResponse.json(
        { error: 'AI extraction not yet available. Install ai and @ai-sdk/anthropic packages.' },
        { status: 501 }
      );
    } catch (error) {
      console.error('AI fact extraction failed:', error);
      return NextResponse.json(
        { error: 'AI extraction failed' },
        { status: 500 }
      );
    }
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/facts/extract POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
