/**
 * Returns a CSS custom property color based on a 0-100 quality score.
 * Uses the completion color tokens defined in globals.css.
 */
export function scoreColor(score: number): string {
  if (score >= 70) return 'var(--completion-high)';
  if (score >= 40) return 'var(--completion-medium)';
  return 'var(--completion-low)';
}
