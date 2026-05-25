export {
  createFactsheet,
  getFactsheet,
  listFactsheets,
  listFactsheetsWithCounts,
  updateFactsheet,
  deleteFactsheet,
  assignFactToFactsheet,
  removeFactFromFactsheet,
} from './queries';
export type { CreateFactsheetInput, UpdateFactsheetInput, FactsheetFilters, FactsheetWithCounts } from './queries';

export {
  createFactsheetLink,
  getFactsheetLinks,
  deleteFactsheetLink,
  getFactsheetCluster,
  suggestFactsheetLinks,
} from './links';
export type { CreateFactsheetLinkInput } from './links';

export { listAllFactsheetLinks } from './links-queries';

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
  _promoteSingleFactsheetInTransaction,
} from './promote';
export type { PromoteSingleInput, PromoteSingleResult, PromoteClusterResult } from './promote';

export { batchDismissFactsheets, batchLinkFactsheets } from './batch';

export {
  unmergeFactsheet,
  _unmergeFactsheetInTransaction,
  isPersonDirtySincePromote,
  FactsheetNotPromotedError,
  PersonDirtyError,
} from './unmerge';
export type { UnmergeFactsheetInput, UnmergeFactsheetResult } from './unmerge';

export {
  computePatchDiff,
  applyPatchDiff,
  hashPatchDiff,
  LegacyPromotionNotPatchableError,
} from './patch';
export type { PatchDiff, FieldDelta, AddedEvent, ModifiedEvent, AddedCitation } from './patch';

export { softDetachFactsheet } from './detach';
export type { SoftDetachInput, SoftDetachResult } from './detach';

export {
  getClusterMembership,
  getClusterMemberFactsheetIds,
  getClusterMembers,
  getClusterEdgeCount,
  ClusterDetachNotSupportedError,
  ClusterMemberUseClusterUnmergeError,
  LegacyClusterNotSupportedError,
} from './cluster';
export type { ClusterMembership, ClusterMember } from './cluster';
