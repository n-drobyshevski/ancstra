import { describe, it, expect } from 'vitest';
import { serializeToGedcom } from '../../lib/gedcom/serialize';
import type { PersonListItem, FamilyRecord, ChildLink } from '@ancstra/shared';

// Helper to build minimal test data
function makePerson(overrides: Partial<PersonListItem> & { id: string }): PersonListItem {
  return {
    givenName: 'John',
    surname: 'Doe',
    sex: 'M',
    isLiving: false,
    birthDate: null,
    deathDate: null,
    ...overrides,
  };
}

interface TestEvent {
  id: string;
  eventType: string;
  dateOriginal: string | null;
  placeText: string | null;
  personId: string | null;
  familyId: string | null;
  [key: string]: unknown;
}

function makeEvent(overrides: Partial<TestEvent> & { id: string; eventType: string }): TestEvent {
  return {
    dateOriginal: null,
    placeText: null,
    personId: null,
    familyId: null,
    ...overrides,
  };
}

describe('serializeToGedcom', () => {
  it('should include HEAD and TRLR records', () => {
    const output = serializeToGedcom(
      { persons: [], families: [], childLinks: [], events: [] },
      'full',
    );
    expect(output).toContain('0 HEAD');
    expect(output).toContain('1 SOUR Ancstra');
    expect(output).toContain('1 GEDC');
    expect(output).toContain('2 VERS 5.5.1');
    expect(output).toContain('2 FORM LINEAGE-LINKED');
    expect(output).toContain('1 CHAR UTF-8');
    expect(output).toContain('0 TRLR');
  });

  it('should start with UTF-8 BOM', () => {
    const output = serializeToGedcom(
      { persons: [], families: [], childLinks: [], events: [] },
      'full',
    );
    expect(output.charCodeAt(0)).toBe(0xfeff);
  });

  it('should serialize a person with /Surname/ NAME convention, GIVN, SURN, SEX', () => {
    const person = makePerson({ id: 'p1', givenName: 'Jane', surname: 'Smith', sex: 'F' });
    const output = serializeToGedcom(
      { persons: [person], families: [], childLinks: [], events: [] },
      'full',
    );
    expect(output).toContain('0 @I1@ INDI');
    expect(output).toContain('1 NAME Jane /Smith/');
    expect(output).toContain('2 GIVN Jane');
    expect(output).toContain('2 SURN Smith');
    expect(output).toContain('1 SEX F');
  });

  it('should serialize person events as sub-records with DATE and PLAC', () => {
    const person = makePerson({ id: 'p1', givenName: 'John', surname: 'Doe', sex: 'M' });
    const events: TestEvent[] = [
      makeEvent({
        id: 'e1',
        eventType: 'birth',
        dateOriginal: '15 MAR 1920',
        placeText: 'New York, USA',
        personId: 'p1',
      }),
      makeEvent({
        id: 'e2',
        eventType: 'death',
        dateOriginal: '22 DEC 1995',
        placeText: 'Boston, USA',
        personId: 'p1',
      }),
    ];
    const output = serializeToGedcom(
      { persons: [person], families: [], childLinks: [], events },
      'full',
    );
    expect(output).toContain('1 BIRT');
    expect(output).toContain('2 DATE 15 MAR 1920');
    expect(output).toContain('2 PLAC New York, USA');
    expect(output).toContain('1 DEAT');
    expect(output).toContain('2 DATE 22 DEC 1995');
    expect(output).toContain('2 PLAC Boston, USA');
  });

  it('should serialize families with HUSB/WIFE/CHIL references using sequential XREFs', () => {
    const persons = [
      makePerson({ id: 'p1', givenName: 'John', surname: 'Doe', sex: 'M' }),
      makePerson({ id: 'p2', givenName: 'Jane', surname: 'Doe', sex: 'F' }),
      makePerson({ id: 'p3', givenName: 'Jimmy', surname: 'Doe', sex: 'M' }),
    ];
    const families: FamilyRecord[] = [
      {
        id: 'f1',
        partner1Id: 'p1',
        partner2Id: 'p2',
        relationshipType: 'married',
        validationStatus: 'confirmed',
      },
    ];
    const childLinks: ChildLink[] = [
      { familyId: 'f1', personId: 'p3', validationStatus: 'confirmed' },
    ];
    const marriageEvent = makeEvent({
      id: 'e1',
      eventType: 'marriage',
      dateOriginal: '10 JUN 1950',
      placeText: 'Chicago, USA',
      familyId: 'f1',
    });

    const output = serializeToGedcom(
      { persons, families, childLinks, events: [marriageEvent] },
      'full',
    );

    // Person XREFs assigned sequentially
    expect(output).toContain('0 @I1@ INDI');
    expect(output).toContain('0 @I2@ INDI');
    expect(output).toContain('0 @I3@ INDI');

    // Family record
    expect(output).toContain('0 @F1@ FAM');
    expect(output).toContain('1 HUSB @I1@');
    expect(output).toContain('1 WIFE @I2@');
    expect(output).toContain('1 CHIL @I3@');

    // Marriage event on family
    expect(output).toContain('1 MARR');
    expect(output).toContain('2 DATE 10 JUN 1950');
    expect(output).toContain('2 PLAC Chicago, USA');
  });

  it('should add FAMS/FAMC references to INDI records', () => {
    const persons = [
      makePerson({ id: 'p1', sex: 'M' }),
      makePerson({ id: 'p2', sex: 'F' }),
      makePerson({ id: 'p3', sex: 'M' }),
    ];
    const families: FamilyRecord[] = [
      {
        id: 'f1',
        partner1Id: 'p1',
        partner2Id: 'p2',
        relationshipType: 'married',
        validationStatus: 'confirmed',
      },
    ];
    const childLinks: ChildLink[] = [
      { familyId: 'f1', personId: 'p3', validationStatus: 'confirmed' },
    ];

    const output = serializeToGedcom(
      { persons, families, childLinks, events: [] },
      'full',
    );

    // Partners should have FAMS
    const lines = output.split('\n');
    // Find the INDI block for p1 (@I1@) and check it has FAMS
    const i1Start = lines.findIndex((l) => l.includes('0 @I1@ INDI'));
    const i1Block = lines.slice(i1Start + 1);
    const i1End = i1Block.findIndex((l) => l.startsWith('0 '));
    const i1Lines = i1Block.slice(0, i1End === -1 ? undefined : i1End);
    expect(i1Lines.some((l) => l.includes('1 FAMS @F1@'))).toBe(true);

    // Child should have FAMC
    const i3Start = lines.findIndex((l) => l.includes('0 @I3@ INDI'));
    const i3Block = lines.slice(i3Start + 1);
    const i3End = i3Block.findIndex((l) => l.startsWith('0 '));
    const i3Lines = i3Block.slice(0, i3End === -1 ? undefined : i3End);
    expect(i3Lines.some((l) => l.includes('1 FAMC @F1@'))).toBe(true);
  });

  describe('shareable mode', () => {
    it('should replace living person name with "Living //" and omit personal events', () => {
      const livingPerson = makePerson({
        id: 'p1',
        givenName: 'Alice',
        surname: 'Secret',
        sex: 'F',
        isLiving: true,
      });
      const events: TestEvent[] = [
        makeEvent({
          id: 'e1',
          eventType: 'birth',
          dateOriginal: '1 JAN 1990',
          placeText: 'Somewhere',
          personId: 'p1',
        }),
      ];

      const output = serializeToGedcom(
        { persons: [livingPerson], families: [], childLinks: [], events },
        'shareable',
      );

      expect(output).toContain('0 @I1@ INDI');
      expect(output).toContain('1 NAME Living //');
      expect(output).toContain('1 SEX F');
      // Should NOT contain real name or events
      expect(output).not.toContain('Alice');
      expect(output).not.toContain('Secret');
      expect(output).not.toContain('BIRT');
      expect(output).not.toContain('1 JAN 1990');
    });

    it('should serialize deceased persons normally in shareable mode', () => {
      const deceasedPerson = makePerson({
        id: 'p1',
        givenName: 'Bob',
        surname: 'Public',
        sex: 'M',
        isLiving: false,
      });
      const events: TestEvent[] = [
        makeEvent({
          id: 'e1',
          eventType: 'birth',
          dateOriginal: '5 MAY 1900',
          placeText: 'London, UK',
          personId: 'p1',
        }),
      ];

      const output = serializeToGedcom(
        { persons: [deceasedPerson], families: [], childLinks: [], events },
        'shareable',
      );

      expect(output).toContain('1 NAME Bob /Public/');
      expect(output).toContain('1 BIRT');
      expect(output).toContain('2 DATE 5 MAY 1900');
    });
  });

  it('should handle events with only DATE or only PLAC', () => {
    const person = makePerson({ id: 'p1' });
    const events: TestEvent[] = [
      makeEvent({ id: 'e1', eventType: 'birth', dateOriginal: '1920', personId: 'p1' }),
      makeEvent({
        id: 'e2',
        eventType: 'death',
        placeText: 'Unknown City',
        personId: 'p1',
      }),
    ];
    const output = serializeToGedcom(
      { persons: [person], families: [], childLinks: [], events },
      'full',
    );

    // Birth has DATE but no PLAC
    const lines = output.split('\n');
    const birtIdx = lines.findIndex((l) => l.includes('1 BIRT'));
    expect(lines[birtIdx + 1]).toContain('2 DATE 1920');
    // No PLAC line immediately after DATE for this event
    const nextLineAfterDate = lines[birtIdx + 2];
    expect(nextLineAfterDate).not.toContain('2 PLAC');

    // Death has PLAC but no DATE
    const deatIdx = lines.findIndex((l) => l.includes('1 DEAT'));
    expect(lines[deatIdx + 1]).toContain('2 PLAC Unknown City');
  });

  it('should map common event types to GEDCOM tags', () => {
    const person = makePerson({ id: 'p1' });
    const events: TestEvent[] = [
      makeEvent({ id: 'e1', eventType: 'burial', dateOriginal: '1920', personId: 'p1' }),
      makeEvent({ id: 'e2', eventType: 'christening', dateOriginal: '1900', personId: 'p1' }),
      makeEvent({ id: 'e3', eventType: 'immigration', dateOriginal: '1925', personId: 'p1' }),
    ];
    const output = serializeToGedcom(
      { persons: [person], families: [], childLinks: [], events },
      'full',
    );
    expect(output).toContain('1 BURI');
    expect(output).toContain('1 CHR');
    expect(output).toContain('1 IMMI');
  });
});
