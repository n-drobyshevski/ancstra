const STORAGE_KEY = 'ancstra:settings';

export type PrivacyLevel = 'public' | 'private' | 'restricted';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  livingThreshold: number;
  defaultPrivacy: PrivacyLevel;
  exportPrivacy: boolean;
}

const defaults: AppSettings = {
  theme: 'system',
  livingThreshold: 100,
  defaultPrivacy: 'private',
  exportPrivacy: true,
};

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next = { ...current, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
