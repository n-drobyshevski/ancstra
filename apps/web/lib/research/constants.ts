export const DISCOVERY_METHOD_LABELS: Record<string, string> = {
  search: 'Search',
  scrape: 'Scrape',
  paste_url: 'Pasted URL',
  paste_text: 'Pasted Text',
  ai_suggestion: 'AI Suggestion',
};

export const CONFIDENCE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  high: 'default',
  medium: 'secondary',
  low: 'outline',
  disputed: 'destructive',
};

export const FACTSHEET_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  ready: {
    label: 'Ready',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  promoted: {
    label: 'Promoted',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  merged: {
    label: 'Merged',
    className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400',
  },
};

export const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  parent_child: 'parent',
  spouse: 'spouse',
  sibling: 'sibling',
};
