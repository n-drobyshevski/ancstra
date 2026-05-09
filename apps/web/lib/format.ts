// Pure formatting helpers — no React or next-intl deps. Translation strings
// are passed in from the call site (built via useTranslations / getTranslations
// in the lib/format-client.ts and lib/format-server.ts wrappers).
//
// Splitting it this way keeps the logic testable in isolation and lets both
// client and server components share the same time-bucketing rules.

export interface RelativeTimeStrings {
  justNow: string;
  minutesAgo: (count: number) => string;
  hoursAgo: (count: number) => string;
  daysAgo: (count: number) => string;
  monthsAgo: (count: number) => string;
  yearsAgo: (count: number) => string;
}

export interface BucketStrings {
  today: string;
  yesterday: string;
  thisWeek: string;
  earlierThisMonth: string;
  earlier: string;
}

export function formatRelativeTime(dateString: string, s: RelativeTimeStrings): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return s.justNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return s.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return s.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return s.daysAgo(days);
  const months = Math.floor(days / 30);
  if (months < 12) return s.monthsAgo(months);
  const years = Math.floor(months / 12);
  return s.yearsAgo(years);
}

/**
 * Coarser-grained relative bucket label used by feed-like surfaces (e.g.
 * Activity). Returns one of: today, yesterday, thisWeek, earlierThisMonth,
 * earlier — translated via the supplied BucketStrings.
 */
export function bucketByRelativeDate(dateString: string, s: BucketStrings): string {
  const now = new Date();
  const date = new Date(dateString);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= 0) return s.today;
  if (diffDays === 1) return s.yesterday;
  if (diffDays < 7) return s.thisWeek;
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  ) {
    return s.earlierThisMonth;
  }
  return s.earlier;
}

/**
 * Group items into the 5 relative buckets returned by `bucketByRelativeDate`.
 * Insertion order is preserved across buckets, so with newest-first input the
 * resulting groups also come out newest-first.
 */
export function groupItemsByRelativeBucket<T>(
  items: T[],
  getDate: (item: T) => string,
  s: BucketStrings,
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  const labelIndex = new Map<string, number>();

  for (const item of items) {
    const label = bucketByRelativeDate(getDate(item), s);
    const existing = labelIndex.get(label);

    if (existing !== undefined) {
      groups[existing].items.push(item);
    } else {
      labelIndex.set(label, groups.length);
      groups.push({ label, items: [item] });
    }
  }

  return groups;
}
