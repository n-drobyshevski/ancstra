import { describe, it, expect } from 'vitest';
import { getVisibleSettingsSections } from '@/components/settings/settings-nav-sections';

describe('getVisibleSettingsSections', () => {
  describe('pre-hydration (role unknown)', () => {
    it('returns only the universal items (no permission needed)', () => {
      const sections = getVisibleSettingsSections(null, false);
      expect(sections.map((s) => s.tier)).toEqual(['profile']);
      const profile = sections[0];
      // Activity has activity:view; pre-hydration is treated as "no role", so
      // Activity is filtered out — only Profile + Appearance + Labs survive.
      // Labs has no permission gate (server-side enforces) so it's universal.
      expect(profile.items.map((i) => i.href)).toEqual([
        '/settings/profile',
        '/settings/appearance',
        '/settings/labs',
      ]);
    });
  });

  describe('viewer', () => {
    it('returns only My profile (Profile, Appearance, Activity, Labs)', () => {
      const sections = getVisibleSettingsSections('viewer', true);
      expect(sections.map((s) => s.tier)).toEqual(['profile']);
      const profile = sections[0];
      expect(profile.items.map((i) => i.href)).toEqual([
        '/settings/profile',
        '/settings/appearance',
        '/activity',
        '/settings/labs',
      ]);
    });
  });

  describe('editor', () => {
    it('shows profile + editor (Editor defaults, Data & Storage); hides admin/owner', () => {
      const sections = getVisibleSettingsSections('editor', true);
      const tiers = sections.map((s) => s.tier);
      expect(tiers).toEqual(['profile', 'editor']);

      const editor = sections.find((s) => s.tier === 'editor')!;
      expect(editor.items.map((i) => i.href)).toEqual([
        '/settings/editor-defaults',
        '/settings/data',
      ]);
    });
  });

  describe('admin', () => {
    it('shows profile + editor + admin (Family, Members, Search Sources); hides owner', () => {
      const sections = getVisibleSettingsSections('admin', true);
      const tiers = sections.map((s) => s.tier);
      expect(tiers).toEqual(['profile', 'editor', 'admin']);

      const admin = sections.find((s) => s.tier === 'admin')!;
      expect(admin.items.map((i) => i.href)).toEqual([
        '/settings/family',
        '/settings/members',
        '/settings/sources',
      ]);
    });
  });

  describe('owner', () => {
    it('shows all four sections; ownership has Privacy + AI only', () => {
      const sections = getVisibleSettingsSections('owner', true);
      const tiers = sections.map((s) => s.tier);
      expect(tiers).toEqual(['profile', 'editor', 'admin', 'owner']);

      const owner = sections.find((s) => s.tier === 'owner')!;
      expect(owner.items.map((i) => i.href)).toEqual([
        '/settings/privacy',
        '/settings/ai',
      ]);
    });
  });

  describe('section ordering', () => {
    it('returns sections in fixed order: profile → editor → admin → owner', () => {
      const sections = getVisibleSettingsSections('owner', true);
      expect(sections.map((s) => s.tier)).toEqual(['profile', 'editor', 'admin', 'owner']);
    });
  });

  describe('section metadata', () => {
    it('every section has a tier and items', () => {
      const sections = getVisibleSettingsSections('owner', true);
      for (const s of sections) {
        expect(s.tier.length).toBeGreaterThan(0);
        expect(s.items.length).toBeGreaterThan(0);
        for (const item of s.items) {
          expect(item.key.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
