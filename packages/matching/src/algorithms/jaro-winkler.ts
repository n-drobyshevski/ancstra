/**
 * Jaro distance between two strings.
 *
 * Returns a value between 0.0 (no similarity) and 1.0 (identical).
 * Both inputs are normalised to uppercase before comparison.
 * Empty strings return 0.0.
 */
export function jaroDistance(s1: string, s2: string): number {
  const a = s1.toUpperCase();
  const b = s2.toUpperCase();

  if (a.length === 0 || b.length === 0) return 0.0;
  if (a === b) return 1.0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);

  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);

  let matches = 0;

  // Find matches
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - matchWindow);
    const hi = Math.min(b.length - 1, i + matchWindow);
    for (let j = lo; j <= hi; j++) {
      if (!bMatched[j] && a[i] === b[j]) {
        aMatched[i] = true;
        bMatched[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const t = transpositions / 2;
  return (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
}

/**
 * Jaro-Winkler distance — applies a prefix boost to the Jaro distance.
 *
 * @param s1 First string
 * @param s2 Second string
 * @param prefixWeight Scaling factor for prefix bonus (default 0.1, max 0.25)
 * @returns Similarity score between 0.0 and 1.0
 */
export function jaroWinkler(
  s1: string,
  s2: string,
  prefixWeight: number = 0.1,
): number {
  const jaro = jaroDistance(s1, s2);
  if (jaro === 0) return 0;

  // Common prefix length, capped at 4
  const a = s1.toUpperCase();
  const b = s2.toUpperCase();
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  let prefixLen = 0;
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) {
      prefixLen++;
    } else {
      break;
    }
  }

  return jaro + prefixLen * prefixWeight * (1 - jaro);
}
