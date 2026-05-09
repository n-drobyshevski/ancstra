// Fallback for the implicit `children` slot when Next.js cannot recover
// the active page state on hard refresh. See:
// https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#defaultjs
//
// We re-export the page so `/dashboard` always resolves consistently whether
// the user soft-navigates or reloads.
export { default } from './page';
