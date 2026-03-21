// docs/architecture/patterns/filter-for-privacy.ts
// Integration target: packages/shared/privacy/living-filter.ts
//
// Addresses: PE-1 (filter completeness), PE-2 (export), AI-1 (AI context)
// Root cause fix: comprehensive filter replacing the name-only version

const LIVING_THRESHOLD_YEARS = 100;

type Role = 'owner' | 'admin' | 'editor' | 'viewer';
type FilterContext = 'api' | 'export_shareable' | 'export_full' | 'ai_context';

interface PersonWithDetails {
  id: string;
  given_name: string;
  surname: string;
  notes: string | null;
  is_living: boolean;
  birth_date_sort?: number;
  death_date_sort?: number;
  events?: EventRecord[];
  media?: MediaRecord[];
  relationships?: RelationshipRecord[];
}

interface EventRecord {
  event_type: string;
  date_original: string | null;
  date_sort: number;
  place_name: string | null;
  description: string | null;
}

interface MediaRecord {
  id: string;
  file_path: string;
  title: string | null;
}

interface RelationshipRecord {
  person_id: string;
  person_name: string;
  relationship_type: string;
}

/**
 * Precedence: is_living=false (explicit override) > death date exists > 100-year threshold > assume living.
 * If is_living is explicitly false, the person is always treated as deceased.
 * If a death date exists, the person is deceased even if is_living was not updated.
 * Otherwise, the 100-year birth threshold determines living status.
 */
export function isPresumablyLiving(person: {
  is_living: boolean;
  birth_date_sort?: number;
  death_date_sort?: number;
}): boolean {
  if (!person.is_living) return false;
  if (person.death_date_sort && person.death_date_sort > 0) return false;
  if (!person.birth_date_sort || person.birth_date_sort === 0) return true;
  const currentYear = new Date().getFullYear();
  const birthYear = Math.floor(person.birth_date_sort / 10000);
  return (currentYear - birthYear) < LIVING_THRESHOLD_YEARS;
}

export function filterForPrivacy<T extends PersonWithDetails>(
  persons: T[],
  viewerRole: Role,
  context: FilterContext = 'api'
): T[] {
  // Owner and admin see everything in API context
  if ((viewerRole === 'owner' || viewerRole === 'admin') && context === 'api') {
    return persons;
  }

  // Full export mode: no filtering
  if (context === 'export_full') return persons;

  return persons.map(person => {
    if (!isPresumablyLiving(person)) return person;

    const birthYear = person.birth_date_sort
      ? Math.floor(person.birth_date_sort / 10000)
      : undefined;

    const birthCountry = person.events
      ?.find(e => e.event_type === 'birth')
      ?.place_name?.split(',').pop()?.trim() ?? null;

    // Determine redaction level based on role + context
    const isViewerLevel =
      viewerRole === 'viewer' ||
      context === 'export_shareable' ||
      context === 'ai_context';

    return {
      ...person,
      // Names: always redact for living persons (except editor in API)
      given_name: isViewerLevel ? 'Living' : person.given_name,
      surname: isViewerLevel ? '' : person.surname,
      notes: null, // Always strip notes for living

      // Events: viewer/export/AI get birth year + country only
      events: isViewerLevel
        ? (birthYear
          ? [{
              event_type: 'birth',
              date_original: String(birthYear),
              date_sort: birthYear * 10000 + 101,
              place_name: birthCountry,
              description: null,
            }]
          : [])
        : person.events?.map(e => ({
            ...e,
            // Editor in API: full events but strip descriptions for living
            description: null,
          })),

      // Media: hidden for viewer/export/AI; shown for editor
      media: isViewerLevel ? [] : person.media,

      // Relationships: viewer/export/AI get counts only
      relationships: isViewerLevel
        ? [{
            person_id: '',
            person_name: `${person.relationships?.length ?? 0} relationships`,
            relationship_type: 'summary',
          }]
        : person.relationships,
    } as T;
  });
}
