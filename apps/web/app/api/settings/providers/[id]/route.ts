import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, searchProviders } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateProviderSchema = z.object({
  isEnabled: z.boolean().optional(),
  config: z.string().optional(), // JSON string for API keys etc.
  rateLimitRpm: z.number().int().min(1).max(1000).optional(),
  baseUrl: z.string().url().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateProviderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const db = createDb();

  const [existing] = db
    .select()
    .from(searchProviders)
    .where(eq(searchProviders.id, id))
    .all();

  if (!existing) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const data = parsed.data;

  if (data.isEnabled !== undefined) updates.isEnabled = data.isEnabled;
  if (data.config !== undefined) updates.config = data.config;
  if (data.rateLimitRpm !== undefined) updates.rateLimitRpm = data.rateLimitRpm;
  if (data.baseUrl !== undefined) updates.baseUrl = data.baseUrl;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(existing);
  }

  db.update(searchProviders)
    .set(updates)
    .where(eq(searchProviders.id, id))
    .run();

  const [updated] = db
    .select()
    .from(searchProviders)
    .where(eq(searchProviders.id, id))
    .all();

  return NextResponse.json(updated);
}
