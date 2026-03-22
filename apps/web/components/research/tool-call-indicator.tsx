'use client';

import { useState } from 'react';
import {
  Search,
  Globe,
  GitBranch,
  AlertTriangle,
  FileText,
  Link,
  Lightbulb,
  BookOpen,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const TOOL_DISPLAY: Record<string, { label: string; icon: typeof Search }> = {
  searchLocalTree: { label: 'Searching your tree...', icon: Search },
  searchFamilySearch: { label: 'Searching FamilySearch...', icon: Globe },
  computeRelationship: { label: 'Computing relationship...', icon: GitBranch },
  analyzeTreeGaps: { label: 'Analyzing gaps...', icon: AlertTriangle },
  explainRecord: { label: 'Explaining record...', icon: BookOpen },
  proposeRelationship: { label: 'Proposing relationship...', icon: GitBranch },
  searchWeb: { label: 'Searching the web...', icon: Globe },
  scrapeUrl: { label: 'Reading page...', icon: Link },
  getResearchItems: { label: 'Loading research items...', icon: FileText },
  extractFacts: { label: 'Extracting facts...', icon: FileText },
  detectConflicts: { label: 'Detecting conflicts...', icon: AlertTriangle },
  suggestSearches: { label: 'Suggesting searches...', icon: Lightbulb },
};

interface ToolCallIndicatorProps {
  toolName: string;
  status: 'calling' | 'complete' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
}

export function ToolCallIndicator({
  toolName,
  status,
  args,
  result,
}: ToolCallIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  const display = TOOL_DISPLAY[toolName] ?? {
    label: toolName,
    icon: FileText,
  };
  const Icon = display.icon;

  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
      >
        {status === 'calling' ? (
          <Loader2 className="size-3 animate-spin" />
        ) : status === 'complete' ? (
          <Check className="size-3 text-green-600" />
        ) : (
          <X className="size-3 text-destructive" />
        )}
        <Icon className="size-3" />
        <span>{display.label}</span>
        {(args || result) && (
          expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )
        )}
      </button>
      {expanded && (
        <div className="mt-1 ml-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          {args && Object.keys(args).length > 0 && (
            <div className="mb-2">
              <p className="mb-1 font-medium text-muted-foreground">Arguments:</p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-foreground">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Result:</p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-foreground max-h-48 overflow-y-auto">
                {typeof result === 'string'
                  ? result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
