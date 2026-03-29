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
    className: 'bg-status-warning-bg text-status-warning-text',
  },
  ready: {
    label: 'Ready',
    className: 'bg-status-success-bg text-status-success-text',
  },
  promoted: {
    label: 'Promoted',
    className: 'bg-status-info-bg text-status-info-text',
  },
  merged: {
    label: 'Merged',
    className: 'bg-status-merged-bg text-status-merged-text',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'bg-status-neutral-bg text-status-neutral-text',
  },
};

export const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  parent_child: 'parent',
  spouse: 'spouse',
  sibling: 'sibling',
};
