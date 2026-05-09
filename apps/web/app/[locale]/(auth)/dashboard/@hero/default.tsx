// Slot fallback for unmatched/recovery state. Returns null so the slot stays
// empty when the dashboard route isn't active; per Next.js 16 upgrade guide,
// re-exporting the page caused stale slot rendering on unrelated routes.
export default function Default() {
  return null;
}
