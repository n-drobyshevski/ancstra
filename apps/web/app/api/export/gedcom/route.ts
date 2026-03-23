import { NextResponse } from 'next/server';
import { events } from '@ancstra/db';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getTreeData } from '@/lib/queries';
import { serializeGedcom, type GedcomVersion } from '@/lib/gedcom';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('gedcom:export');

    const { searchParams } = new URL(request.url);
    const version = (searchParams.get('version') || '5.5.1') as GedcomVersion;
    const includeLiving = searchParams.get('includeLiving') !== 'false';
    const includeSources = searchParams.get('includeSources') !== 'false';

    // Validate version parameter
    if (version !== '5.5.1' && version !== '7.0') {
      return NextResponse.json(
        { error: 'Invalid version. Must be "5.5.1" or "7.0".' },
        { status: 400 },
      );
    }

    // Gather tree data
    const { persons, families, childLinks } = await getTreeData(familyDb);
    const allEvents = await familyDb.select().from(events).all();

    // Filter out living persons if requested
    const filteredPersons = includeLiving
      ? persons
      : persons.filter((p) => !p.isLiving);

    // When excluding living persons, also filter out their events
    const livingIds = new Set(
      persons.filter((p) => p.isLiving).map((p) => p.id),
    );
    const filteredEvents = includeLiving
      ? allEvents
      : allEvents.filter((e) => !e.personId || !livingIds.has(e.personId));

    const mode = includeLiving ? 'full' : 'shareable';

    const gedcom = serializeGedcom(
      {
        persons: filteredPersons,
        families,
        childLinks,
        events: filteredEvents,
      },
      { version, mode },
    );

    const versionLabel = version === '7.0' ? '70' : '551';
    const filename = `ancstra-export-${versionLabel}-${mode}.ged`;

    return new Response(gedcom, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
