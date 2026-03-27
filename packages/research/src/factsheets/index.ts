export {
  createFactsheet,
  getFactsheet,
  listFactsheets,
  updateFactsheet,
  deleteFactsheet,
  assignFactToFactsheet,
  removeFactFromFactsheet,
} from './queries';
export type { CreateFactsheetInput, UpdateFactsheetInput, FactsheetFilters } from './queries';

export {
  createFactsheetLink,
  getFactsheetLinks,
  deleteFactsheetLink,
  getFactsheetCluster,
  suggestFactsheetLinks,
} from './links';
export type { CreateFactsheetLinkInput } from './links';

export {
  detectFactsheetConflicts,
  resolveFactsheetConflict,
  isFactsheetPromotable,
} from './validation';
export type { FactsheetConflict, PromotabilityResult } from './validation';

export { checkDuplicates } from './duplicate-check';
export type { DuplicateMatch } from './duplicate-check';

export {
  promoteSingleFactsheet,
  promoteFactsheetCluster,
} from './promote';
export type { PromoteSingleInput, PromoteSingleResult, PromoteClusterResult } from './promote';
