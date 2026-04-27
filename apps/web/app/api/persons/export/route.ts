import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { personsCache } from '@/lib/persons/search-params';
import { queryPersonsForCsvExport, EXPORT_HARD_CAP } from '@/lib/persons/query-export';
import { serializePersonsToCsv } from '@/lib/persons/export-csv';
import { exportPersonsToGedcom } from '@/lib/persons/export-gedcom';

const MAX_EXPLICIT_IDS = 100;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('gedcom:export', request);

    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    if (format !== 'csv' && format !== 'gedcom') {
      return NextResponse.json(
        { error: 'format must be "csv" or "gedcom"' },
        { status: 400 },
      );
    }

    // Parse filter contract via personsCache (excluding the export-only params)
    const rawParams: Record<string, string | string[]> = {};
    url.searchParams.forEach((value, key) => {
      if (key === 'format' || key === 'ids' || key === 'exclude') return;
      const existing = rawParams[key];
      if (existing === undefined) {
        rawParams[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        rawParams[key] = [existing, value];
      }
    });
    const filters = await personsCache.parse(rawParams);

    const excludeRaw = url.searchParams.get('exclude');
    const exclude = excludeRaw ? excludeRaw.split(',').filter((s) => s.length > 0) : [];

    const idsRaw = url.searchParams.get('ids');
    let explicitIds: string[] | undefined;
    if (idsRaw) {
      explicitIds = idsRaw.split(',').filter((s) => s.length > 0);
      if (explicitIds.length > MAX_EXPLICIT_IDS) {
        return NextResponse.json(
          { error: `Explicit-id selection exceeds ${MAX_EXPLICIT_IDS}; refine via filters instead.` },
          { status: 422 },
        );
      }
    }

    const date = todayIso();

    if (format === 'csv') {
      const rows = await queryPersonsForCsvExport(familyDb, filters, exclude, explicitIds);
      if (rows.length > EXPORT_HARD_CAP) {
        return NextResponse.json(
          { error: `Export exceeds the ${EXPORT_HARD_CAP} hard cap. Refine your filters.` },
          { status: 422 },
        );
      }
      const body = serializePersonsToCsv(rows);
      return new Response(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ancstra-people-${date}.csv"`,
          'Cache-Control': 'no-store',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // gedcom
    const body = await exportPersonsToGedcom(familyDb, filters, exclude, explicitIds);
    return new Response(body, {
      headers: {
        'Content-Type': 'application/x-gedcom; charset=utf-8',
        'Content-Disposition': `attachment; filename="ancstra-people-${date}.ged"`,
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
