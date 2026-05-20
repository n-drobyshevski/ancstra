export type {
  ThreadStatus,
  ThreadEventType,
  CreateThreadInput,
  UpdateThreadInput,
  AddEventInput,
  ListThreadsFilters,
  ListPersonsTouchedOptions,
  ThreadTimelineCursor,
  ThreadTimelinePage,
} from './types';

// Implementations added in Tasks 4-9
export { createThread } from './create';
export { addEvent, getThreadTimeline, getThreadTimelinePage } from './events';
export { listThreads, getThread, getPersonsTouchedByThread, getThreadsForPerson } from './queries';
export type { ThreadTouchSummary } from './queries';
export { pauseThread, resolveThread, abandonThread, resumeThread } from './lifecycle';
export { updateThread } from './update';
export { cascade } from './cascade';
export type { CascadeInput, CascadeResult } from './cascade';
