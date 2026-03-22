import { createDb } from './index.js';
import { users, persons, personNames, events } from './schema.js';
import bcrypt from 'bcryptjs';

const db = createDb();

async function seed() {
  console.log('Seeding database...');

  // Create dev user
  const passwordHash = await bcrypt.hash('password', 10);
  const [devUser] = db.insert(users).values({
    email: 'dev@ancstra.app',
    passwordHash,
    name: 'Dev User',
  }).returning().all();
  console.log(`Created user: ${devUser.email}`);

  // Create sample persons
  const samplePersons = [
    { sex: 'M' as const, isLiving: false, notes: 'Prominent farmer in Sangamon County', createdBy: devUser.id },
    { sex: 'F' as const, isLiving: false, createdBy: devUser.id },
    { sex: 'M' as const, isLiving: false, createdBy: devUser.id },
  ];

  for (const personData of samplePersons) {
    const [person] = db.insert(persons).values(personData).returning().all();

    if (personData.sex === 'M' && personData.notes) {
      // John Smith
      db.insert(personNames).values({
        personId: person.id, givenName: 'John', surname: 'Smith',
        nameType: 'birth', isPrimary: true,
      }).run();
      db.insert(events).values({
        personId: person.id, eventType: 'birth',
        dateOriginal: '15 Mar 1845', dateSort: 18450315,
        placeText: 'Springfield, Sangamon, Illinois, USA',
      }).run();
      db.insert(events).values({
        personId: person.id, eventType: 'death',
        dateOriginal: '23 Nov 1923', dateSort: 19231123,
        placeText: 'Chicago, Cook, Illinois, USA',
      }).run();
      console.log(`Created person: John Smith`);
    } else if (personData.sex === 'F') {
      // Mary Johnson
      db.insert(personNames).values({
        personId: person.id, givenName: 'Mary', surname: 'Johnson',
        nameType: 'birth', isPrimary: true,
      }).run();
      db.insert(events).values({
        personId: person.id, eventType: 'birth',
        dateOriginal: '1850', dateSort: 18500101, dateModifier: 'about',
        placeText: 'Springfield, Illinois, USA',
      }).run();
      console.log(`Created person: Mary Johnson`);
    } else {
      // William Smith Jr
      db.insert(personNames).values({
        personId: person.id, givenName: 'William', surname: 'Smith',
        suffix: 'Jr', nameType: 'birth', isPrimary: true,
      }).run();
      db.insert(events).values({
        personId: person.id, eventType: 'birth',
        dateOriginal: '1870', dateSort: 18700101, dateModifier: 'about',
      }).run();
      console.log(`Created person: William Smith Jr`);
    }
  }

  console.log('Seed complete!');
}

seed().catch(console.error);
