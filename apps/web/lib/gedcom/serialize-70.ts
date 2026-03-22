import type { GedcomExportData, GedcomExportEvent, ExportMode } from './serialize';

/** Map internal event type strings to GEDCOM tags */
const EVENT_TYPE_TO_TAG: Record<string, string> = {
  birth: 'BIRT',
  death: 'DEAT',
  marriage: 'MARR',
  burial: 'BURI',
  christening: 'CHR',
  baptism: 'BAPM',
  immigration: 'IMMI',
  emigration: 'EMIG',
  naturalization: 'NATU',
  census: 'CENS',
  probate: 'PROB',
  will: 'WILL',
  graduation: 'GRAD',
  retirement: 'RETI',
  divorce: 'DIV',
  annulment: 'ANUL',
  engagement: 'ENGA',
  residence: 'RESI',
  occupation: 'OCCU',
};

function getGedcomTag(eventType: string): string {
  return EVENT_TYPE_TO_TAG[eventType.toLowerCase()] ?? 'EVEN';
}

/**
 * Serialize tree data to GEDCOM 7.0 format.
 *
 * Key differences from 5.5.1:
 * - No UTF-8 BOM prefix (always UTF-8, no CHAR line)
 * - Header uses `GEDC` with `VERS 7.0` (no FORM sub-record)
 * - Includes SOUR with NAME sub-record
 *
 * @param data - persons, families, childLinks, events
 * @param mode - 'full' or 'shareable' (living persons redacted)
 * @returns GEDCOM 7.0 string
 */
export function serializeGedcom70(data: GedcomExportData, mode: ExportMode): string {
  const { persons, families, childLinks, events } = data;
  const lines: string[] = [];

  // Build UUID → XREF maps
  const personXref = new Map<string, string>();
  persons.forEach((p, i) => {
    personXref.set(p.id, `@I${i + 1}@`);
  });

  const familyXref = new Map<string, string>();
  families.forEach((f, i) => {
    familyXref.set(f.id, `@F${i + 1}@`);
  });

  // Index events by personId and familyId
  const eventsByPerson = new Map<string, GedcomExportEvent[]>();
  const eventsByFamily = new Map<string, GedcomExportEvent[]>();
  for (const evt of events) {
    if (evt.personId) {
      const list = eventsByPerson.get(evt.personId) ?? [];
      list.push(evt);
      eventsByPerson.set(evt.personId, list);
    }
    if (evt.familyId) {
      const list = eventsByFamily.get(evt.familyId) ?? [];
      list.push(evt);
      eventsByFamily.set(evt.familyId, list);
    }
  }

  // Build FAMS and FAMC indexes
  const famsForPerson = new Map<string, string[]>();
  const famcForPerson = new Map<string, string[]>();

  for (const fam of families) {
    if (fam.partner1Id) {
      const list = famsForPerson.get(fam.partner1Id) ?? [];
      list.push(fam.id);
      famsForPerson.set(fam.partner1Id, list);
    }
    if (fam.partner2Id) {
      const list = famsForPerson.get(fam.partner2Id) ?? [];
      list.push(fam.id);
      famsForPerson.set(fam.partner2Id, list);
    }
  }

  for (const cl of childLinks) {
    const list = famcForPerson.get(cl.personId) ?? [];
    list.push(cl.familyId);
    famcForPerson.set(cl.personId, list);
  }

  // --- HEAD (GEDCOM 7.0) ---
  lines.push('0 HEAD');
  lines.push('1 GEDC');
  lines.push('2 VERS 7.0');
  lines.push('1 SOUR Ancstra');
  lines.push('2 VERS 1.0');
  lines.push('2 NAME Ancstra');

  // --- INDI records ---
  for (const person of persons) {
    const xref = personXref.get(person.id)!;
    const isRedacted = mode === 'shareable' && person.isLiving;

    lines.push(`0 ${xref} INDI`);

    if (isRedacted) {
      lines.push('1 NAME Living //');
    } else {
      lines.push(`1 NAME ${person.givenName} /${person.surname}/`);
      lines.push(`2 GIVN ${person.givenName}`);
      lines.push(`2 SURN ${person.surname}`);
    }

    lines.push(`1 SEX ${person.sex}`);

    // Person events (skip for redacted living persons)
    if (!isRedacted) {
      const personEvents = eventsByPerson.get(person.id) ?? [];
      for (const evt of personEvents) {
        const tag = getGedcomTag(evt.eventType);
        lines.push(`1 ${tag}`);
        if (evt.dateOriginal) {
          lines.push(`2 DATE ${evt.dateOriginal}`);
        }
        if (evt.placeText) {
          lines.push(`2 PLAC ${evt.placeText}`);
        }
      }
    }

    // FAMS references
    const famsList = famsForPerson.get(person.id) ?? [];
    for (const famId of famsList) {
      const famRef = familyXref.get(famId);
      if (famRef) lines.push(`1 FAMS ${famRef}`);
    }

    // FAMC references
    const famcList = famcForPerson.get(person.id) ?? [];
    for (const famId of famcList) {
      const famRef = familyXref.get(famId);
      if (famRef) lines.push(`1 FAMC ${famRef}`);
    }
  }

  // --- FAM records ---
  for (const fam of families) {
    const xref = familyXref.get(fam.id)!;
    lines.push(`0 ${xref} FAM`);

    if (fam.partner1Id) {
      const ref = personXref.get(fam.partner1Id);
      if (ref) lines.push(`1 HUSB ${ref}`);
    }
    if (fam.partner2Id) {
      const ref = personXref.get(fam.partner2Id);
      if (ref) lines.push(`1 WIFE ${ref}`);
    }

    // Children
    const children = childLinks.filter((cl) => cl.familyId === fam.id);
    for (const cl of children) {
      const ref = personXref.get(cl.personId);
      if (ref) lines.push(`1 CHIL ${ref}`);
    }

    // Family events (e.g. marriage)
    const famEvents = eventsByFamily.get(fam.id) ?? [];
    for (const evt of famEvents) {
      const tag = getGedcomTag(evt.eventType);
      lines.push(`1 ${tag}`);
      if (evt.dateOriginal) {
        lines.push(`2 DATE ${evt.dateOriginal}`);
      }
      if (evt.placeText) {
        lines.push(`2 PLAC ${evt.placeText}`);
      }
    }
  }

  // --- TRLR ---
  lines.push('0 TRLR');

  // GEDCOM 7.0: no BOM prefix, always UTF-8
  return lines.join('\n') + '\n';
}
