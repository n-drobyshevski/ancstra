import type { formats } from './i18n/formats';
import type { routing } from './i18n/routing';

type Messages = {
  common: typeof import('./messages/en/common.json');
  errors: typeof import('./messages/en/errors.json');
  'error-pages': typeof import('./messages/en/error-pages.json');
  navigation: typeof import('./messages/en/navigation.json');
  auth: typeof import('./messages/en/auth.json');
  dashboard: typeof import('./messages/en/dashboard.json');
  activity: typeof import('./messages/en/activity.json');
  analytics: typeof import('./messages/en/analytics.json');
  persons: typeof import('./messages/en/persons.json');
  tree: typeof import('./messages/en/tree.json');
  settings: typeof import('./messages/en/settings.json');
  admin: typeof import('./messages/en/admin.json');
  rubric: typeof import('./messages/en/rubric.json');
};

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Messages;
    Formats: typeof formats;
  }
}

export {};
