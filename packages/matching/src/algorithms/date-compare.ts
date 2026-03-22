export type DateCompareLevel =
  | 'exact'
  | 'within_1yr'
  | 'within_2yr'
  | 'same_decade'
  | 'no_match'
  | 'unknown';

export interface DateCompareResult {
  level: DateCompareLevel;
  score: number;
}

/**
 * Convert a YYYYMMDD dateSort integer to an approximate day count
 * for arithmetic comparison.
 */
function dateSortToDays(dateSort: number): number {
  const year = Math.floor(dateSort / 10000);
  const month = Math.floor((dateSort % 10000) / 100);
  const day = dateSort % 100;
  // Approximate: 365.25 days/year, 30.44 days/month
  return year * 365.25 + (month - 1) * 30.44 + day;
}

/**
 * Compare two dateSort values (YYYYMMDD integers) and return a tiered
 * similarity score.
 *
 * Scoring tiers:
 * - exact (1.0): identical dates
 * - within_1yr (0.9): <= 366 days apart
 * - within_2yr (0.75): <= 731 days apart
 * - same_decade (0.5): <= 3653 days apart
 * - no_match (0.0): > 3653 days apart
 * - unknown (0.5): one or both dates are null (neutral)
 */
export function compareDates(
  dateSort1: number | null,
  dateSort2: number | null,
): DateCompareResult {
  if (dateSort1 == null || dateSort2 == null) {
    return { level: 'unknown', score: 0.5 };
  }

  if (dateSort1 === dateSort2) {
    return { level: 'exact', score: 1.0 };
  }

  const days1 = dateSortToDays(dateSort1);
  const days2 = dateSortToDays(dateSort2);
  const diff = Math.abs(days1 - days2);

  if (diff <= 366) return { level: 'within_1yr', score: 0.9 };
  if (diff <= 731) return { level: 'within_2yr', score: 0.75 };
  if (diff <= 3653) return { level: 'same_decade', score: 0.5 };
  return { level: 'no_match', score: 0.0 };
}
