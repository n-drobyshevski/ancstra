// Backward-compatible re-export. Source of truth lives in `use-viewport.ts`.
// New code should import `useViewport` directly when it needs more than just
// "below md".
export { useIsMobile } from "./use-viewport"
