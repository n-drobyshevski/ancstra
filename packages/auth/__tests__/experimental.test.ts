import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import { eq } from 'drizzle-orm';
import {
  EXPERIMENTAL_FEATURE_KEYS,
  resolveExperimentalState,
  isExperimentalFeatureEnabled,
  requireExperimentalFeature,
} from '../src/experimental';
import { ForbiddenError } from '../src/types';

async function seedUser(db: TestCentralDb, id: string) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values({
    id,
    email: `${id}@test.com`,
    name: id,
    createdAt: now,
    updatedAt: now,
  }).run();
}

async function setPolicy(db: TestCentralDb, allowUsers: boolean) {
  await db.update(centralSchema.platformSettings)
    .set({ experimentalFeaturesAllowUsers: allowUsers ? 1 : 0 })
    .where(eq(centralSchema.platformSettings.id, 'global'))
    .run();
}

async function setUserPrefs(db: TestCentralDb, userId: string, prefs: {
  master?: boolean;
  features?: Partial<Record<typeof EXPERIMENTAL_FEATURE_KEYS[number], boolean>>;
}) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.userPreferences).values({
    userId,
    experimentalEnabled: prefs.master ? 1 : 0,
    experimentalFeatures: JSON.stringify(prefs.features ?? {}),
    updatedAt: now,
  }).run();
}

describe('EXPERIMENTAL_FEATURE_KEYS', () => {
  it('lists the three known feature keys', () => {
    expect([...EXPERIMENTAL_FEATURE_KEYS].sort()).toEqual(
      ['biography', 'historicalContext', 'researchChat'],
    );
  });
});

describe('resolveExperimentalState', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'alice');
  });

  it('returns all-off when policy disallows users (no prefs row)', async () => {
    await setPolicy(db, false);
    const state = await resolveExperimentalState(db, 'alice');
    expect(state.policyAllowsUsers).toBe(false);
    expect(state.masterEnabled).toBe(false);
    expect(state.perFeature).toEqual({
      biography: false,
      researchChat: false,
      historicalContext: false,
    });
    expect(state.isEnabled('biography')).toBe(false);
  });

  it('returns all-off when policy allows users but master is off', async () => {
    await setPolicy(db, true);
    await setUserPrefs(db, 'alice', { master: false });
    const state = await resolveExperimentalState(db, 'alice');
    expect(state.policyAllowsUsers).toBe(true);
    expect(state.masterEnabled).toBe(false);
    expect(state.perFeature.biography).toBe(false);
    expect(state.isEnabled('researchChat')).toBe(false);
  });

  it('returns all-on by default when both policy and master are on with no per-feature overrides', async () => {
    await setPolicy(db, true);
    await setUserPrefs(db, 'alice', { master: true });
    const state = await resolveExperimentalState(db, 'alice');
    expect(state.policyAllowsUsers).toBe(true);
    expect(state.masterEnabled).toBe(true);
    expect(state.perFeature).toEqual({
      biography: true,
      researchChat: true,
      historicalContext: true,
    });
    expect(state.isEnabled('biography')).toBe(true);
    expect(state.isEnabled('researchChat')).toBe(true);
    expect(state.isEnabled('historicalContext')).toBe(true);
  });

  it('disables only the explicitly-false features in the override JSON', async () => {
    await setPolicy(db, true);
    await setUserPrefs(db, 'alice', {
      master: true,
      features: { biography: false },
    });
    const state = await resolveExperimentalState(db, 'alice');
    expect(state.perFeature).toEqual({
      biography: false,
      researchChat: true,
      historicalContext: true,
    });
  });

  it('treats explicit true overrides as on (idempotent with default)', async () => {
    await setPolicy(db, true);
    await setUserPrefs(db, 'alice', {
      master: true,
      features: { biography: true, historicalContext: false },
    });
    const state = await resolveExperimentalState(db, 'alice');
    expect(state.perFeature).toEqual({
      biography: true,
      researchChat: true,
      historicalContext: false,
    });
  });

  it('overrides cannot enable a feature when policy is off', async () => {
    await setPolicy(db, false);
    await setUserPrefs(db, 'alice', {
      master: true,
      features: { biography: true, researchChat: true, historicalContext: true },
    });
    const state = await resolveExperimentalState(db, 'alice');
    expect(state.perFeature.biography).toBe(false);
    expect(state.perFeature.researchChat).toBe(false);
    expect(state.perFeature.historicalContext).toBe(false);
  });

  it('overrides cannot enable a feature when master is off', async () => {
    await setPolicy(db, true);
    await setUserPrefs(db, 'alice', {
      master: false,
      features: { biography: true },
    });
    const state = await resolveExperimentalState(db, 'alice');
    expect(state.perFeature.biography).toBe(false);
  });

  it('handles malformed JSON in experimental_features by defaulting to {}', async () => {
    await setPolicy(db, true);
    const now = new Date().toISOString();
    await db.insert(centralSchema.userPreferences).values({
      userId: 'alice',
      experimentalEnabled: 1,
      experimentalFeatures: 'not-json',
      updatedAt: now,
    }).run();
    const state = await resolveExperimentalState(db, 'alice');
    // Master on + malformed JSON → all features default true
    expect(state.perFeature.biography).toBe(true);
    expect(state.perFeature.researchChat).toBe(true);
  });

  it('ignores unknown feature keys in the override JSON', async () => {
    await setPolicy(db, true);
    const now = new Date().toISOString();
    await db.insert(centralSchema.userPreferences).values({
      userId: 'alice',
      experimentalEnabled: 1,
      experimentalFeatures: JSON.stringify({ biography: false, futureFeatureX: true }),
      updatedAt: now,
    }).run();
    const state = await resolveExperimentalState(db, 'alice');
    expect(state.perFeature.biography).toBe(false);
    expect(state.perFeature.researchChat).toBe(true);
    // No 'futureFeatureX' key on the resolved map
    expect(Object.keys(state.perFeature).sort()).toEqual(
      ['biography', 'historicalContext', 'researchChat'],
    );
  });

  it('handles missing platform_settings row by treating policy as off', async () => {
    // Simulate a freshly-cloned dev DB where the singleton hasn't been seeded.
    await db.delete(centralSchema.platformSettings)
      .where(eq(centralSchema.platformSettings.id, 'global'))
      .run();
    await setUserPrefs(db, 'alice', { master: true });
    const state = await resolveExperimentalState(db, 'alice');
    expect(state.policyAllowsUsers).toBe(false);
    expect(state.isEnabled('biography')).toBe(false);
  });
});

describe('isExperimentalFeatureEnabled', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'alice');
  });

  it('returns true only when both gates and the feature override allow it', async () => {
    await setPolicy(db, true);
    await setUserPrefs(db, 'alice', { master: true, features: { biography: false } });
    expect(await isExperimentalFeatureEnabled(db, 'alice', 'biography')).toBe(false);
    expect(await isExperimentalFeatureEnabled(db, 'alice', 'researchChat')).toBe(true);
  });
});

describe('requireExperimentalFeature', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'alice');
  });

  it('throws ForbiddenError when feature is disabled', async () => {
    await setPolicy(db, false);
    await expect(
      requireExperimentalFeature(db, 'alice', 'biography'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('does not throw when feature is enabled', async () => {
    await setPolicy(db, true);
    await setUserPrefs(db, 'alice', { master: true });
    await expect(
      requireExperimentalFeature(db, 'alice', 'biography'),
    ).resolves.toBeUndefined();
  });
});
