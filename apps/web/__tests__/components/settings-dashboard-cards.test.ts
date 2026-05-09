import { describe, it, expect } from 'vitest';
import { getDashboardCards } from '@/components/settings/settings-dashboard-cards';
import welcomeMessages from '@/messages/en/settings.json';

describe('getDashboardCards', () => {
  it('viewer sees only personal cards (incl. Labs as opt-in entry point)', () => {
    const cards = getDashboardCards('viewer');
    expect(cards.map((c) => c.href)).toEqual([
      '/settings/profile',
      '/settings/appearance',
      '/activity',
      '/settings/labs',
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

  it('every card has a key (with matching translation), href, and icon', () => {
    const cards = getDashboardCards('owner');
    for (const c of cards) {
      expect(c.key.length).toBeGreaterThan(0);
      expect(c.href).toMatch(/^\//);
      expect(c.icon).toBeDefined();
      // The translation file must carry a title + description for every key.
      const entry = welcomeMessages.cards[c.key as keyof typeof welcomeMessages.cards];
      expect(entry).toBeDefined();
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('every role sees Labs as the last card in their array', () => {
    for (const role of ['viewer', 'editor', 'admin', 'owner'] as const) {
      const cards = getDashboardCards(role);
      const last = cards[cards.length - 1];
      expect(last.key).toBe('labs');
      expect(last.href).toBe('/settings/labs');
      expect(last.experimental).toBe(true);
      expect(last.primary).not.toBe(true);
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

describe('settings.welcome translations', () => {
  it('has a distinct tagline for each role', () => {
    const taglines = new Set([
      welcomeMessages.welcome.owner.tagline,
      welcomeMessages.welcome.admin.tagline,
      welcomeMessages.welcome.editor.tagline,
      welcomeMessages.welcome.viewer.tagline,
    ]);
    expect(taglines.size).toBe(4);
    expect(welcomeMessages.welcome.owner.title.toLowerCase()).toMatch(/owner|manage|settings/);
    expect(welcomeMessages.welcome.viewer.title.length).toBeGreaterThan(0);
  });
});
