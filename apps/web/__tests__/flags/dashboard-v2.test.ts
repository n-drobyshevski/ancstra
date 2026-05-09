import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDashboardV2Enabled } from '@/lib/flags/dashboard-v2';

describe('isDashboardV2Enabled (Phase 6 — default ON)', () => {
  const KEY = 'NEXT_PUBLIC_DASHBOARD_V2';
  const original = process.env[KEY];

  beforeEach(() => {
    delete process.env[KEY];
  });
  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it('defaults to TRUE when env var is unset (Phase 6 default-on)', () => {
    expect(isDashboardV2Enabled()).toBe(true);
  });

  it('defaults to TRUE for arbitrary non-disabling values', () => {
    process.env[KEY] = 'true';
    expect(isDashboardV2Enabled()).toBe(true);
    process.env[KEY] = '1';
    expect(isDashboardV2Enabled()).toBe(true);
    process.env[KEY] = 'yes';
    expect(isDashboardV2Enabled()).toBe(true);
    process.env[KEY] = '';
    expect(isDashboardV2Enabled()).toBe(true);
  });

  it('disables only on the explicit opt-out values "false" or "0"', () => {
    process.env[KEY] = 'false';
    expect(isDashboardV2Enabled()).toBe(false);
    process.env[KEY] = '0';
    expect(isDashboardV2Enabled()).toBe(false);
  });

  it('is case-sensitive — "FALSE" does not disable', () => {
    process.env[KEY] = 'FALSE';
    expect(isDashboardV2Enabled()).toBe(true);
  });
});
