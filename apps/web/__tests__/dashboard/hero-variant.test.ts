import { describe, it, expect } from 'vitest';
import { selectHeroVariant } from '@/lib/dashboard/hero-variant';

describe('selectHeroVariant', () => {
  it('routes owner to family-health hero', () => {
    expect(selectHeroVariant('owner')).toBe('family-health');
  });

  it('routes admin to moderation hero', () => {
    expect(selectHeroVariant('admin')).toBe('moderation');
  });

  it('routes editor to research-focus hero', () => {
    expect(selectHeroVariant('editor')).toBe('research-focus');
  });

  it('routes viewer to explore hero', () => {
    expect(selectHeroVariant('viewer')).toBe('explore');
  });

  it('falls back to null when role is unknown', () => {
    expect(selectHeroVariant(null)).toBeNull();
  });

  it('lens-as-viewer flips an owner to the explore variant (effective-role contract)', () => {
    // Caller passes the *effective* role; this just confirms the mapping is
    // role-driven, not actual-role-driven. The lens system applies upstream.
    // An owner under a viewer lens should see the viewer experience.
    expect(selectHeroVariant('viewer')).toBe('explore');
    expect(selectHeroVariant('owner')).toBe('family-health');
  });

  it('lens-as-admin flips an owner to the moderation variant', () => {
    // An owner under the admin lens should see ModerationHero. The hero slot
    // composes that with a hasPermission check; this test pins the mapping.
    expect(selectHeroVariant('admin')).toBe('moderation');
  });

  it('lens-as-editor flips an owner to the research-focus variant', () => {
    // An owner under the editor lens should see ResearchFocusHero. Slot
    // composes with `ai:research` perm check; this test pins the mapping.
    expect(selectHeroVariant('editor')).toBe('research-focus');
  });
});
