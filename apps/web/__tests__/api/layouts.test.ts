import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { createLayoutSchema, updateLayoutSchema } from '../../lib/validation';

const { treeLayouts } = schema;

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });

  sqlite.exec(`
    CREATE TABLE tree_layouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      layout_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
});

afterEach(() => {
  sqlite.close();
});

function createLayout(overrides: Partial<{
  id: string;
  name: string;
  isDefault: boolean;
  layoutData: string;
}> = {}) {
  const now = new Date().toISOString();
  const id = overrides.id ?? crypto.randomUUID();

  db.insert(treeLayouts)
    .values({
      id,
      name: overrides.name ?? 'Test Layout',
      isDefault: overrides.isDefault ?? false,
      layoutData: overrides.layoutData ?? '{"nodes":[]}',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

describe('Layout CRUD (integration)', () => {
  it('POST creates layout with name and data', () => {
    const input = { name: 'My Layout', layoutData: '{"nodes":[]}', isDefault: false };
    const parsed = createLayoutSchema.safeParse(input);
    expect(parsed.success).toBe(true);

    const id = createLayout({ name: input.name, layoutData: input.layoutData });

    const [layout] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id)).all();
    expect(layout).toBeDefined();
    expect(layout.name).toBe('My Layout');
    expect(layout.layoutData).toBe('{"nodes":[]}');
    expect(layout.isDefault).toBe(false);
  });

  it('GET lists layouts without layoutData', () => {
    createLayout({ name: 'Alpha' });
    createLayout({ name: 'Beta' });
    createLayout({ name: 'Gamma' });

    // Simulate the GET list query: select only summary fields, ordered by name
    const layouts = db
      .select({
        id: treeLayouts.id,
        name: treeLayouts.name,
        isDefault: treeLayouts.isDefault,
        updatedAt: treeLayouts.updatedAt,
      })
      .from(treeLayouts)
      .orderBy(treeLayouts.name)
      .all();

    expect(layouts).toHaveLength(3);
    expect(layouts[0].name).toBe('Alpha');
    expect(layouts[1].name).toBe('Beta');
    expect(layouts[2].name).toBe('Gamma');

    // Verify layoutData is NOT in the result
    const keys = Object.keys(layouts[0]);
    expect(keys).not.toContain('layoutData');
  });

  it('GET /[id] returns full layout with layoutData', () => {
    const id = createLayout({ name: 'Detail Layout', layoutData: '{"zoom":1.5}' });

    const [layout] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id)).all();
    expect(layout).toBeDefined();
    expect(layout.name).toBe('Detail Layout');
    expect(layout.layoutData).toBe('{"zoom":1.5}');
    expect(layout.id).toBe(id);
  });

  it('PUT updates layout name', () => {
    const id = createLayout({ name: 'Old Name' });

    const input = { name: 'New Name' };
    const parsed = updateLayoutSchema.safeParse(input);
    expect(parsed.success).toBe(true);

    const now = new Date().toISOString();
    db.update(treeLayouts)
      .set({ name: 'New Name', updatedAt: now })
      .where(eq(treeLayouts.id, id))
      .run();

    const [updated] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id)).all();
    expect(updated.name).toBe('New Name');
  });

  it('PUT updates layout data', () => {
    const id = createLayout({ name: 'Data Layout', layoutData: '{"old":true}' });

    const input = { layoutData: '{"new":true}' };
    const parsed = updateLayoutSchema.safeParse(input);
    expect(parsed.success).toBe(true);

    const now = new Date().toISOString();
    db.update(treeLayouts)
      .set({ layoutData: '{"new":true}', updatedAt: now })
      .where(eq(treeLayouts.id, id))
      .run();

    const [updated] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id)).all();
    expect(updated.layoutData).toBe('{"new":true}');
  });

  it('DELETE removes layout', () => {
    const id = createLayout({ name: 'To Delete' });

    // Verify it exists
    const [before] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id)).all();
    expect(before).toBeDefined();

    // Delete
    db.delete(treeLayouts).where(eq(treeLayouts.id, id)).run();

    // Verify it is gone
    const after = db.select().from(treeLayouts).where(eq(treeLayouts.id, id)).all();
    expect(after).toHaveLength(0);
  });

  it('PUT /[id]/default sets default and unsets previous', () => {
    const id1 = createLayout({ name: 'Layout A', isDefault: true });
    const id2 = createLayout({ name: 'Layout B', isDefault: false });

    // Verify initial state
    const [a1] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id1)).all();
    expect(a1.isDefault).toBe(true);

    // Set layout B as default via transaction (mirrors the route logic)
    db.transaction((tx) => {
      tx.update(treeLayouts)
        .set({ isDefault: false })
        .where(eq(treeLayouts.isDefault, true))
        .run();

      tx.update(treeLayouts)
        .set({ isDefault: true })
        .where(eq(treeLayouts.id, id2))
        .run();
    });

    // Layout B should now be default
    const [b] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id2)).all();
    expect(b.isDefault).toBe(true);

    // Layout A should no longer be default
    const [a2] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id1)).all();
    expect(a2.isDefault).toBe(false);
  });

  it('only one default at a time', () => {
    const id1 = createLayout({ name: 'First', isDefault: true });
    const id2 = createLayout({ name: 'Second', isDefault: false });
    const id3 = createLayout({ name: 'Third', isDefault: false });

    // Set second as default
    db.transaction((tx) => {
      tx.update(treeLayouts)
        .set({ isDefault: false })
        .where(eq(treeLayouts.isDefault, true))
        .run();
      tx.update(treeLayouts)
        .set({ isDefault: true })
        .where(eq(treeLayouts.id, id2))
        .run();
    });

    // Set third as default
    db.transaction((tx) => {
      tx.update(treeLayouts)
        .set({ isDefault: false })
        .where(eq(treeLayouts.isDefault, true))
        .run();
      tx.update(treeLayouts)
        .set({ isDefault: true })
        .where(eq(treeLayouts.id, id3))
        .run();
    });

    // Only one default should exist
    const defaults = db
      .select()
      .from(treeLayouts)
      .where(eq(treeLayouts.isDefault, true))
      .all();
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(id3);

    // Verify the others are not default
    const [l1] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id1)).all();
    const [l2] = db.select().from(treeLayouts).where(eq(treeLayouts.id, id2)).all();
    expect(l1.isDefault).toBe(false);
    expect(l2.isDefault).toBe(false);
  });
});
