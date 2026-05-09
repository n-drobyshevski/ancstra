import { getTranslations } from 'next-intl/server';
import {
  formatRelativeTime,
  type BucketStrings,
  type RelativeTimeStrings,
} from './format';

export async function getRelativeTimeStrings(): Promise<RelativeTimeStrings> {
  const t = await getTranslations('common.relativeTime');
  return {
    justNow: t('justNow'),
    minutesAgo: (count) => t('minutesAgo', { count }),
    hoursAgo: (count) => t('hoursAgo', { count }),
    daysAgo: (count) => t('daysAgo', { count }),
    monthsAgo: (count) => t('monthsAgo', { count }),
    yearsAgo: (count) => t('yearsAgo', { count }),
  };
}

export async function getBucketStrings(): Promise<BucketStrings> {
  const t = await getTranslations('common.dateBuckets');
  return {
    today: t('today'),
    yesterday: t('yesterday'),
    thisWeek: t('thisWeek'),
    earlierThisMonth: t('earlierThisMonth'),
    earlier: t('earlier'),
  };
}

/** Convenience wrapper: returns a pre-bound formatter for server components. */
export async function getFormatRelativeTime(): Promise<(dateString: string) => string> {
  const strings = await getRelativeTimeStrings();
  return (dateString) => formatRelativeTime(dateString, strings);
}
