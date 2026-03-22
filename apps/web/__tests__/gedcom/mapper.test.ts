import { describe, it, expect } from 'vitest';
import { parseGedcomName, parseGedcomDate, mapGedcomToImport } from '../../lib/gedcom/mapper';
import { parseGedcomString } from '../../lib/gedcom/parse';

// ---------------------------------------------------------------------------
// parseGedcomName
// ---------------------------------------------------------------------------
describe('parseGedcomName', () => {
  it('parses surname only: /Smith/', () => {
    const result = parseGedcomName('/Smith/');
    expect(result.surname).toBe('Smith');
    expect(result.givenName).toBe('');
    expect(result.suffix).toBe(null);
  });

  it('parses full name: John /Smith/ Jr', () => {
    const result = parseGedcomName('John /Smith/ Jr');
    expect(result.givenName).toBe('John');
    expect(result.surname).toBe('Smith');
    expect(result.suffix).toBe('Jr');
  });

  it('parses given + surname: John /Smith/', () => {
    const result = parseGedcomName('John /Smith/');
    expect(result.givenName).toBe('John');
    expect(result.surname).toBe('Smith');
    expect(result.suffix).toBe(null);
  });

  it('fallback: John Smith (no slashes)', () => {
    const result = parseGedcomName('John Smith');
    expect(result.givenName).toBe('John');
    expect(result.surname).toBe('Smith');
    expect(result.suffix).toBe(null);
  });

  it('handles empty string', () => {
    const result = parseGedcomName('');
    expect(result.givenName).toBe('');
    expect(result.surname).toBe('');
    expect(result.suffix).toBe(null);
  });

  it('trims whitespace around parts', () => {
    const result = parseGedcomName('  Mary Ann  /O\'Brien/  III  ');
    expect(result.givenName).toBe("Mary Ann");
    expect(result.surname).toBe("O'Brien");
    expect(result.suffix).toBe('III');
  });
});

// ---------------------------------------------------------------------------
// parseGedcomDate
// ---------------------------------------------------------------------------
describe('parseGedcomDate', () => {
  it('parses exact date: 15 MAR 1845', () => {
    const result = parseGedcomDate('15 MAR 1845');
    expect(result.dateOriginal).toBe('15 MAR 1845');
    expect(result.dateSort).toBe(18450315);
    expect(result.dateModifier).toBe(null);
    expect(result.dateEndSort).toBe(null);
  });

  it('parses ABT 1850 → about', () => {
    const result = parseGedcomDate('ABT 1850');
    expect(result.dateModifier).toBe('about');
    expect(result.dateOriginal).toBe('ABT 1850');
    expect(result.dateSort).toBe(18500101);
  });

  it('parses BEF 1900 → before', () => {
    const result = parseGedcomDate('BEF 1900');
    expect(result.dateModifier).toBe('before');
    expect(result.dateSort).toBe(19000101);
  });

  it('parses AFT 1800 → after', () => {
    const result = parseGedcomDate('AFT 1800');
    expect(result.dateModifier).toBe('after');
    expect(result.dateSort).toBe(18000101);
  });

  it('parses EST 1870 → estimated', () => {
    const result = parseGedcomDate('EST 1870');
    expect(result.dateModifier).toBe('estimated');
  });

  it('parses CAL 1870 → calculated', () => {
    const result = parseGedcomDate('CAL 1870');
    expect(result.dateModifier).toBe('calculated');
  });

  it('parses BET 1880 AND 1885 → between with start and end', () => {
    const result = parseGedcomDate('BET 1880 AND 1885');
    expect(result.dateModifier).toBe('between');
    expect(result.dateSort).toBe(18800101);
    expect(result.dateEndSort).toBe(18850101);
    expect(result.dateOriginal).toBe('BET 1880 AND 1885');
  });

  it('parses BET 15 MAR 1880 AND 20 JUN 1885', () => {
    const result = parseGedcomDate('BET 15 MAR 1880 AND 20 JUN 1885');
    expect(result.dateModifier).toBe('between');
    expect(result.dateSort).toBe(18800315);
    expect(result.dateEndSort).toBe(18850620);
  });

  it('returns all null for empty string', () => {
    const result = parseGedcomDate('');
    expect(result.dateOriginal).toBe(null);
    expect(result.dateSort).toBe(null);
    expect(result.dateModifier).toBe(null);
    expect(result.dateEndSort).toBe(null);
  });

  it('parses INT 1865 → interpreted', () => {
    const result = parseGedcomDate('INT 1865');
    expect(result.dateModifier).toBe('interpreted');
  });
});

// ---------------------------------------------------------------------------
// mapGedcomToImport — individuals
// ---------------------------------------------------------------------------
describe('mapGedcomToImport — individuals', () => {
  it('maps INDI with name to person + name', () => {
    const gedcom = `0 @I1@ INDI
1 NAME John /Smith/
1 SEX M`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.persons).toHaveLength(1);
    expect(result.persons[0].sex).toBe('M');
    expect(result.persons[0].xref).toBe('@I1@');

    expect(result.names).toHaveLength(1);
    expect(result.names[0].givenName).toBe('John');
    expect(result.names[0].surname).toBe('Smith');
    expect(result.names[0].isPrimary).toBe(true);
    expect(result.names[0].personId).toBe(result.persons[0].id);
  });

  it('maps INDI with GIVN/SURN sub-tags overriding slash parsing', () => {
    const gedcom = `0 @I1@ INDI
1 NAME John /Smith/
2 GIVN Jonathan
2 SURN Smithson
1 SEX M`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.names[0].givenName).toBe('Jonathan');
    expect(result.names[0].surname).toBe('Smithson');
  });

  it('defaults sex to U when missing', () => {
    const gedcom = `0 @I1@ INDI
1 NAME Jane /Doe/`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.persons[0].sex).toBe('U');
  });

  it('captures NOTE on a person', () => {
    const gedcom = `0 @I1@ INDI
1 NAME Test /Person/
1 NOTE This is a note about the person.`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.persons[0].notes).toBe('This is a note about the person.');
  });
});

// ---------------------------------------------------------------------------
// mapGedcomToImport — events
// ---------------------------------------------------------------------------
describe('mapGedcomToImport — events', () => {
  it('maps BIRT event with date and place', () => {
    const gedcom = `0 @I1@ INDI
1 NAME John /Smith/
1 BIRT
2 DATE 15 MAR 1845
2 PLAC Boston, Massachusetts`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    const birth = result.events.find(e => e.eventType === 'birth');
    expect(birth).toBeDefined();
    expect(birth!.dateOriginal).toBe('15 MAR 1845');
    expect(birth!.dateSort).toBe(18450315);
    expect(birth!.placeText).toBe('Boston, Massachusetts');
    expect(birth!.personId).toBe(result.persons[0].id);
    expect(birth!.familyId).toBe(null);
  });

  it('maps DEAT event', () => {
    const gedcom = `0 @I1@ INDI
1 NAME John /Smith/
1 DEAT
2 DATE 20 JUN 1900
2 PLAC New York`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    const death = result.events.find(e => e.eventType === 'death');
    expect(death).toBeDefined();
    expect(death!.dateSort).toBe(19000620);
  });

  it('maps BURI, OCCU, RESI events', () => {
    const gedcom = `0 @I1@ INDI
1 NAME John /Smith/
1 BURI
2 DATE 22 JUN 1900
2 PLAC Oak Hill Cemetery
1 OCCU Farmer
1 RESI
2 PLAC Springfield, Illinois`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.events.find(e => e.eventType === 'burial')).toBeDefined();
    expect(result.events.find(e => e.eventType === 'occupation')).toBeDefined();
    expect(result.events.find(e => e.eventType === 'residence')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// mapGedcomToImport — families
// ---------------------------------------------------------------------------
describe('mapGedcomToImport — families', () => {
  it('maps FAM with HUSB, WIFE, and CHIL', () => {
    const gedcom = `0 @I1@ INDI
1 NAME John /Smith/
1 SEX M
0 @I2@ INDI
1 NAME Jane /Doe/
1 SEX F
0 @I3@ INDI
1 NAME Jimmy /Smith/
1 SEX M
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.families).toHaveLength(1);
    const fam = result.families[0];
    expect(fam.xref).toBe('@F1@');

    // partner IDs should map to actual UUIDs
    const john = result.persons.find(p => p.xref === '@I1@');
    const jane = result.persons.find(p => p.xref === '@I2@');
    const jimmy = result.persons.find(p => p.xref === '@I3@');

    expect(fam.partner1Id).toBe(john!.id);
    expect(fam.partner2Id).toBe(jane!.id);

    expect(result.childLinks).toHaveLength(1);
    expect(result.childLinks[0].familyId).toBe(fam.id);
    expect(result.childLinks[0].personId).toBe(jimmy!.id);
  });

  it('maps MARR event on FAM record', () => {
    const gedcom = `0 @I1@ INDI
1 NAME John /Smith/
0 @I2@ INDI
1 NAME Jane /Doe/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 10 JUN 1870
2 PLAC Boston`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    const marriage = result.events.find(e => e.eventType === 'marriage');
    expect(marriage).toBeDefined();
    expect(marriage!.familyId).toBe(result.families[0].id);
    expect(marriage!.personId).toBe(null);
    expect(marriage!.dateSort).toBe(18700610);
  });

  it('maps DIV event on FAM record', () => {
    const gedcom = `0 @I1@ INDI
1 NAME John /Smith/
0 @I2@ INDI
1 NAME Jane /Doe/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 DIV
2 DATE 5 SEP 1880`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    const divorce = result.events.find(e => e.eventType === 'divorce');
    expect(divorce).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// mapGedcomToImport — living detection
// ---------------------------------------------------------------------------
describe('mapGedcomToImport — living detection', () => {
  it('detects living person (no DEAT, born recently)', () => {
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - 30;
    const gedcom = `0 @I1@ INDI
1 NAME Living /Person/
1 BIRT
2 DATE 1 JAN ${birthYear}`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.persons[0].isLiving).toBe(true);
  });

  it('detects deceased person (has DEAT)', () => {
    const gedcom = `0 @I1@ INDI
1 NAME Dead /Person/
1 BIRT
2 DATE 1 JAN 1900
1 DEAT
2 DATE 1 JAN 1970`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.persons[0].isLiving).toBe(false);
  });

  it('detects deceased when born > 100 years ago with no DEAT', () => {
    const gedcom = `0 @I1@ INDI
1 NAME Old /Person/
1 BIRT
2 DATE 1 JAN 1850`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.persons[0].isLiving).toBe(false);
  });

  it('assumes living when no birth and no death', () => {
    const gedcom = `0 @I1@ INDI
1 NAME Unknown /Person/`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    // Safer default: presumed living if no info
    expect(result.persons[0].isLiving).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mapGedcomToImport — warnings
// ---------------------------------------------------------------------------
describe('mapGedcomToImport — warnings', () => {
  it('warns on death before birth', () => {
    const gedcom = `0 @I1@ INDI
1 NAME Bad /Dates/
1 BIRT
2 DATE 1 JAN 1900
1 DEAT
2 DATE 1 JAN 1850`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    const warn = result.warnings.find(w => w.message.toLowerCase().includes('death before birth'));
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
    expect(warn!.xref).toBe('@I1@');
  });

  it('warns on missing name', () => {
    const gedcom = `0 @I1@ INDI
1 SEX M`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    const warn = result.warnings.find(w => w.message.toLowerCase().includes('missing name'));
    expect(warn).toBeDefined();
    expect(warn!.type).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// mapGedcomToImport — stats
// ---------------------------------------------------------------------------
describe('mapGedcomToImport — stats', () => {
  it('counts skipped SOUR records', () => {
    const gedcom = `0 @I1@ INDI
1 NAME Test /Person/
0 @S1@ SOUR
1 TITL A Source
0 @S2@ SOUR
1 TITL Another Source`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.stats.skippedSources).toBe(2);
    expect(result.stats.persons).toBe(1);
  });

  it('counts persons, families, and events', () => {
    const gedcom = `0 @I1@ INDI
1 NAME John /Smith/
1 BIRT
2 DATE 1 JAN 1850
0 @I2@ INDI
1 NAME Jane /Doe/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 10 JUN 1870`;
    const nodes = parseGedcomString(gedcom);
    const result = mapGedcomToImport(nodes);

    expect(result.stats.persons).toBe(2);
    expect(result.stats.families).toBe(1);
    expect(result.stats.events).toBe(2); // birth + marriage
  });
});
