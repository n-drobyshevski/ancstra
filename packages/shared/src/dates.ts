/**
 * Parse a genealogical date string to a YYYYMMDD integer for sorting.
 * Handles: "15 Mar 1872", "1880", "Mar 1872", "1872-03-15"
 * Returns null if unparseable.
 */
export function parseDateToSort(dateStr: string): number | null {
  if (!dateStr || !dateStr.trim()) return null;

  const s = dateStr.trim();

  // ISO format: 1872-03-15
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return parseInt(isoMatch[1]) * 10000 + parseInt(isoMatch[2]) * 100 + parseInt(isoMatch[3]);
  }

  // Year only: 1880
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) {
    return parseInt(yearOnly[1]) * 10000 + 101; // Jan 1 of that year
  }

  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  // "15 Mar 1872" or "Mar 1872"
  const fullMatch = s.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/i);
  if (fullMatch) {
    const month = months[fullMatch[2].toLowerCase()];
    if (month) {
      return parseInt(fullMatch[3]) * 10000 + month * 100 + parseInt(fullMatch[1]);
    }
  }

  const monthYearMatch = s.match(/^(\w{3})\s+(\d{4})$/i);
  if (monthYearMatch) {
    const month = months[monthYearMatch[1].toLowerCase()];
    if (month) {
      return parseInt(monthYearMatch[2]) * 10000 + month * 100 + 1;
    }
  }

  return null;
}
