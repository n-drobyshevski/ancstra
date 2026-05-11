import { describe, it, expect } from 'vitest';
import { hidesMobileNav } from '@/components/layout/mobile-nav';

/**
 * `hidesMobileNav` suppresses the global mobile dock on routes whose
 * primary action lives in a fixed bottom bar of their own (z-50, e.g.
 * the PersonForm "Save Person" footer). Keep these in sync with the
 * component-side bottom-bar additions — when a new route claims the
 * bottom slot, add a case here.
 */
describe('hidesMobileNav', () => {
  describe('routes that hide the dock', () => {
    it('hides on /persons/new', () => {
      expect(hidesMobileNav('/persons/new')).toBe(true);
    });

    it('hides on /persons/{id}/edit', () => {
      expect(hidesMobileNav('/persons/abc-123/edit')).toBe(true);
      expect(hidesMobileNav('/persons/e4e4f516-166c-46be-9cf3-45f749c805a7/edit')).toBe(true);
    });

    it('hides on locale-prefixed equivalents (en, ru)', () => {
      expect(hidesMobileNav('/en/persons/new')).toBe(true);
      expect(hidesMobileNav('/ru/persons/new')).toBe(true);
      expect(hidesMobileNav('/ru/persons/abc/edit')).toBe(true);
    });
  });

  describe('routes that keep the dock', () => {
    it('does NOT hide on /persons (list)', () => {
      expect(hidesMobileNav('/persons')).toBe(false);
    });

    it('does NOT hide on a person detail (read-only) view', () => {
      expect(hidesMobileNav('/persons/abc-123')).toBe(false);
    });

    it('does NOT hide on /dashboard, /tree, /research', () => {
      expect(hidesMobileNav('/dashboard')).toBe(false);
      expect(hidesMobileNav('/tree')).toBe(false);
      expect(hidesMobileNav('/research')).toBe(false);
    });

    it('does NOT hide on settings routes', () => {
      expect(hidesMobileNav('/settings')).toBe(false);
      expect(hidesMobileNav('/settings/members')).toBe(false);
    });

    it('does NOT match adjacent paths that happen to contain /new', () => {
      // Defensive — guards against a future `/persons/newest` ever being
      // misclassified by a loose prefix check.
      expect(hidesMobileNav('/persons/newest')).toBe(false);
      expect(hidesMobileNav('/persons/abc/edits')).toBe(false);
      expect(hidesMobileNav('/persons/abc/edit/foo')).toBe(false);
    });
  });
});
