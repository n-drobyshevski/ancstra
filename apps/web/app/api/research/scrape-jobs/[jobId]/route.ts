import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getScrapeJob } from '@ancstra/research';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { jobId } = await params;
    const job = await getScrapeJob(familyDb, jobId);

    if (!job) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Return status only — no fullText (keep poll responses small)
    return NextResponse.json({
      id: job.id,
      itemId: job.itemId,
      status: job.status,
      error: job.error ?? null,
      completedAt: job.completedAt ?? null,
    });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/scrape-jobs/[jobId] GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
