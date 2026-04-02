import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { sql } from 'drizzle-orm';
import type { PersonGap } from '@/lib/research/suggestions';

interface PersonRow {
  id: string;
  givenName: string;
  surname: string;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  itemCount: number;
}

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research', request);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 20);

    // Find non-living persons sorted by fewest linked research items.
    // Join person_names to get the primary name, and aggregate birth/death
    // event data in a single query to avoid N+1.
    const rows = await familyDb.all<PersonRow>(sql`
      SELECT
        p.id,
        COALESCE(pn.given_name, '') AS givenName,
        COALESCE(pn.surname, '')    AS surname,
        MAX(CASE WHEN e.event_type = 'BIRT' THEN e.date_original END) AS birthDate,
        MAX(CASE WHEN e.event_type = 'BIRT' THEN e.place_text    END) AS birthPlace,
        MAX(CASE WHEN e.event_type = 'DEAT' THEN e.date_original END) AS deathDate,
        MAX(CASE WHEN e.event_type = 'DEAT' THEN e.place_text    END) AS deathPlace,
        COUNT(DISTINCT rip.research_item_id)                           AS itemCount
      FROM persons p
      LEFT JOIN person_names pn
        ON pn.person_id = p.id AND pn.is_primary = 1
      LEFT JOIN events e
        ON e.person_id = p.id
      LEFT JOIN research_item_persons rip
        ON rip.person_id = p.id
      WHERE p.is_living = 0
        AND p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY itemCount ASC, p.created_at DESC
      LIMIT ${limit}
    `);

    const gaps: PersonGap[] = rows.map((row) => {
      const missingTypes: string[] = [];
      if (!row.birthDate && !row.birthPlace) missingTypes.push('birth record');
      if (!row.deathDate && !row.deathPlace) missingTypes.push('death record');
      if (missingTypes.length === 0) missingTypes.push('additional records');

      return {
        personId: row.id,
        personName: [row.givenName, row.surname].filter(Boolean).join(' ') || 'Unknown',
        birthDate: row.birthDate ?? null,
        birthPlace: row.birthPlace ?? null,
        deathDate: row.deathDate ?? null,
        deathPlace: row.deathPlace ?? null,
        missingTypes,
      };
    });

    return NextResponse.json({ gaps });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/suggestions GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
