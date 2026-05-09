'use client';

import { useTranslations } from 'next-intl';
import {
  formatRelativeTime,
  groupItemsByRelativeBucket,
  type BucketStrings,
  type RelativeTimeStrings,
} from './format';

export function useRelativeTimeStrings(): RelativeTimeStrings {
  const t = useTranslations('common.relativeTime');
  return {
    justNow: t('justNow'),
    minutesAgo: (count) => t('minutesAgo', { count }),
    hoursAgo: (count) => t('hoursAgo', { count }),
    daysAgo: (count) => t('daysAgo', { count }),
    monthsAgo: (count) => t('monthsAgo', { count }),
    yearsAgo: (count) => t('yearsAgo', { count }),
  };
}

export function useBucketStrings(): BucketStrings {
  const t = useTranslations('common.dateBuckets');
  return {
    today: t('today'),
    yesterday: t('yesterday'),
    thisWeek: t('thisWeek'),
    earlierThisMonth: t('earlierThisMonth'),
    earlier: t('earlier'),
  };
}

export function useFormatRelativeTime(): (dateString: string) => string {
  const strings = useRelativeTimeStrings();
  return (dateString) => formatRelativeTime(dateString, strings);
}

export function useGroupItemsByRelativeBucket(): <T>(
  items: T[],
  getDate: (item: T) => string,
) => { label: string; items: T[] }[] {
  const strings = useBucketStrings();
  return (items, getDate) => groupItemsByRelativeBucket(items, getDate, strings);
}
