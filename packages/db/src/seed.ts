import { createCentralDb, createFamilyDb } from './index';
import { persons, personNames, events, familyUserCache } from './family-schema';
import { users, familyRegistry, familyMembers } from './central-schema';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function seed() {
  console.log('Seeding database...');

  // 1. Ensure ~/.ancstra/ directory structure exists
  const ancstraDir = path.join(os.homedir(), '.ancstra');
  const familiesDir = path.join(ancstraDir, 'families');
  fs.mkdirSync(familiesDir, { recursive: true });
  console.log(`Ensured directory: ${familiesDir}`);

  // 2. Create central DB with 4 users
  const centralDb = createCentralDb();
  const passwordHash = await bcrypt.hash('password', 10);

  const userDefs = [
    { email: 'dev@ancstra.app', name: 'Dev User (Owner)' },
    { email: 'admin@ancstra.app', name: 'Admin User' },
    { email: 'editor@ancstra.app', name: 'Editor User' },
    { email: 'viewer@ancstra.app', name: 'Viewer User' },
  ] as const;

  const createdUsers: Array<{ id: string; email: string; name: string }> = [];

  for (const def of userDefs) {
    const [user] = await centralDb.insert(users).values({
      email: def.email,
      passwordHash,
      name: def.name,
    }).returning().all();
    createdUsers.push(user);
    console.log(`Created user: ${user.email} (${user.id})`);
  }

  const [ownerUser, adminUser, editorUser, viewerUser] = createdUsers;

  // 3. Create a family registry entry
  const familyId = crypto.randomUUID();
  const dbFilename = `family-${familyId}.sqlite`;

  await centralDb.insert(familyRegistry).values({
    id: familyId,
    name: 'Smith Family Tree',
    ownerId: ownerUser.id,
    dbFilename,
  }).run();
  console.log(`Created family: Smith Family Tree (${familyId})`);

  // 4. Create family_members entries for all 4 users
  const memberDefs: Array<{ userId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' }> = [
    { userId: ownerUser.id, role: 'owner' },
    { userId: adminUser.id, role: 'admin' },
    { userId: editorUser.id, role: 'editor' },
    { userId: viewerUser.id, role: 'viewer' },
  ];

  for (const def of memberDefs) {
    await centralDb.insert(familyMembers).values({
      familyId,
      userId: def.userId,
      role: def.role,
      isActive: 1,
    }).run();
    console.log(`Added ${def.role} membership for user ${def.userId}`);
  }

  // 5. Populate the family DB with sample tree data
  const familyDb = createFamilyDb(dbFilename);

  const samplePersons = [
    { sex: 'M' as const, isLiving: false, notes: 'Prominent farmer in Sangamon County', createdBy: ownerUser.id },
    { sex: 'F' as const, isLiving: false, createdBy: ownerUser.id },
    { sex: 'M' as const, isLiving: false, createdBy: ownerUser.id },
  ];

  for (const personData of samplePersons) {
    const [person] = await familyDb.insert(persons).values(personData).returning().all();

    if (personData.sex === 'M' && personData.notes) {
      // John Smith
      await familyDb.insert(personNames).values({
        personId: person.id, givenName: 'John', surname: 'Smith',
        nameType: 'birth', isPrimary: true,
      }).run();
      await familyDb.insert(events).values({
        personId: person.id, eventType: 'birth',
        dateOriginal: '15 Mar 1845', dateSort: 18450315,
        placeText: 'Springfield, Sangamon, Illinois, USA',
      }).run();
      await familyDb.insert(events).values({
        personId: person.id, eventType: 'death',
        dateOriginal: '23 Nov 1923', dateSort: 19231123,
        placeText: 'Chicago, Cook, Illinois, USA',
      }).run();
      console.log(`Created person: John Smith`);
    } else if (personData.sex === 'F') {
      // Mary Johnson
      await familyDb.insert(personNames).values({
        personId: person.id, givenName: 'Mary', surname: 'Johnson',
        nameType: 'birth', isPrimary: true,
      }).run();
      await familyDb.insert(events).values({
        personId: person.id, eventType: 'birth',
        dateOriginal: '1850', dateSort: 18500101, dateModifier: 'about',
        placeText: 'Springfield, Illinois, USA',
      }).run();
      console.log(`Created person: Mary Johnson`);
    } else {
      // William Smith Jr
      await familyDb.insert(personNames).values({
        personId: person.id, givenName: 'William', surname: 'Smith',
        suffix: 'Jr', nameType: 'birth', isPrimary: true,
      }).run();
      await familyDb.insert(events).values({
        personId: person.id, eventType: 'birth',
        dateOriginal: '1870', dateSort: 18700101, dateModifier: 'about',
      }).run();
      console.log(`Created person: William Smith Jr`);
    }
  }

  // 6. Populate family_user_cache for all 4 users
  for (const user of createdUsers) {
    await familyDb.insert(familyUserCache).values({
      userId: user.id,
      name: user.name,
      avatarUrl: null,
    }).run();
    console.log(`Cached user in family DB: ${user.name}`);
  }

  console.log('Seed complete!');
}

seed().catch(console.error);
