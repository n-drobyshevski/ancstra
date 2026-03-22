// Algorithms
export { jaroDistance, jaroWinkler } from './algorithms/jaro-winkler';
export { compareDates } from './algorithms/date-compare';
export type { DateCompareResult, DateCompareLevel } from './algorithms/date-compare';
export { comparePlaces } from './algorithms/place-compare';
export type { PlaceCompareResult, PlaceCompareLevel } from './algorithms/place-compare';

// Scoring
export { computeMatchScore, defaultWeights } from './scoring/composite-scorer';
export type { MatchInput, MatchWeights, MatchResult } from './scoring/composite-scorer';
export { generateBlockingKey, findCandidateBlocks } from './scoring/blocking';
