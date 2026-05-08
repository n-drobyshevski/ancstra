import { describe, it, expect } from 'vitest';
import {
  getDashboardCards,
  getDashboardWelcome,
} from '@/components/settings/settings-dashboard-cards';

describe('getDashboardCards', () => {
  it('viewer sees only personal cards', () => {
    const cards = getDashboardCards('viewer');
    expect(cards.map((c) => c.href)).toEqual([
      '/settings/profile',
      '/settings/appearance',
      '/activity',
    ]);
  });

  it('editor sees personal + Editor defaults + Data & Storage', () => {
    const cards = getDashboardCards('editor');
    const hrefs = cards.map((c) => c.href);
    expect(hrefs).toContain('/settings/profile');
    expect(hrefs).toContain('/settings/editor-defaults');
    expect(hrefs).toContain('/settings/data');
    expect(hrefs).not.toContain('/settings/family');
    expect(hrefs).not.toContain('/settings/ai');
  });

  it('admin sees personal + admin tools (incl. Search Sources after P3 tier shift); no ownership', () => {
    const cards = getDashboardCards('admin');
    const hrefs = cards.map((c) => c.href);
    expect(hrefs).toContain('/settings/family');
    expect(hrefs).toContain('/settings/members');
    expect(hrefs).toContain('/settings/sources');
    expect(hrefs).toContain('/settings/editor-defaults');
    expect(hrefs).not.toContain('/settings/ai');
    expect(hrefs).not.toContain('/settings/privacy');
  });

  it('owner sees everything including AI / Privacy / Sources', () => {
    const cards = getDashboardCards('owner');
    const hrefs = cards.map((c) => c.href);
    expect(hrefs).toContain('/settings/profile');
    expect(hrefs).toContain('/settings/family');
    expect(hrefs).toContain('/settings/ai');
    expect(hrefs).toContain('/settings/privacy');
    expect(hrefs).toContain('/settings/sources');
  });

  it('every card has a title, description, href, and icon', () => {
    const cards = getDashboardCards('owner');
    for (const c of cards) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
      expect(c.href).toMatch(/^\//);
      expect(c.icon).toBeDefined();
    }
  });

  it('marks the primary card per role', () => {
    const ownerCards = getDashboardCards('owner');
    expect(ownerCards.find((c) => c.primary)?.href).toBe('/settings/family');

    const adminCards = getDashboardCards('admin');
    expect(adminCards.find((c) => c.primary)?.href).toBe('/settings/members');

    const editorCards = getDashboardCards('editor');
    expect(editorCards.find((c) => c.primary)?.href).toBe('/settings/editor-defaults');

    const viewerCards = getDashboardCards('viewer');
    expect(viewerCards.find((c) => c.primary)?.href).toBe('/settings/profile');
  });
});

describe('getDashboardWelcome', () => {
  it('returns a role-specific tagline for each role', () => {
    const owner = getDashboardWelcome('owner');
    const admin = getDashboardWelcome('admin');
    const editor = getDashboardWelcome('editor');
    const viewer = getDashboardWelcome('viewer');

    // All four are distinct so each role gets tailored copy.
    const taglines = new Set([owner.tagline, admin.tagline, editor.tagline, viewer.tagline]);
    expect(taglines.size).toBe(4);

    expect(owner.title.toLowerCase()).toMatch(/owner|manage|settings/);
    expect(viewer.title.length).toBeGreaterThan(0);
  });
});
