'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  readShowDates,
  writeShowDates,
  readShowLivingIndicator,
  writeShowLivingIndicator,
  readShowMinimap,
  writeShowMinimap,
  readShowDataQuality,
  writeShowDataQuality,
  readShowProposals,
  writeShowProposals,
  readShowCitations,
  writeShowCitations,
  readColoring,
  writeColoring,
  readEdgeStyle,
  writeEdgeStyle,
  type Coloring,
  type EdgeStyle,
} from './view-prefs-storage';

export interface TreeViewPrefs {
  showDates: boolean;
  showLivingIndicator: boolean;
  showMinimap: boolean;
  showDataQuality: boolean;
  showProposals: boolean;
  showCitations: boolean;
  coloring: Coloring;
  edges: EdgeStyle;
}

const DEFAULTS: TreeViewPrefs = {
  showDates: true,
  showLivingIndicator: true,
  showMinimap: true,
  showDataQuality: false,
  showProposals: false,
  showCitations: false,
  coloring: 'off',
  edges: 'curved',
};

export interface TreeViewPrefsApi extends TreeViewPrefs {
  setShowDates: (v: boolean) => void;
  setShowLivingIndicator: (v: boolean) => void;
  setShowMinimap: (v: boolean) => void;
  setShowDataQuality: (v: boolean) => void;
  setShowProposals: (v: boolean) => void;
  setShowCitations: (v: boolean) => void;
  setColoring: (v: Coloring) => void;
  setEdges: (v: EdgeStyle) => void;
}

export function useTreeViewPrefs(): TreeViewPrefsApi {
  // SSR-safe: start from defaults, then hydrate from localStorage on mount.
  // Same pattern as `readStoredDensity` in `tree-layout.tsx`.
  const [state, setState] = useState<TreeViewPrefs>(DEFAULTS);

  useEffect(() => {
    setState({
      showDates: readShowDates() ?? DEFAULTS.showDates,
      showLivingIndicator: readShowLivingIndicator() ?? DEFAULTS.showLivingIndicator,
      showMinimap: readShowMinimap() ?? DEFAULTS.showMinimap,
      showDataQuality: readShowDataQuality() ?? DEFAULTS.showDataQuality,
      showProposals: readShowProposals() ?? DEFAULTS.showProposals,
      showCitations: readShowCitations() ?? DEFAULTS.showCitations,
      coloring: readColoring() ?? DEFAULTS.coloring,
      edges: readEdgeStyle() ?? DEFAULTS.edges,
    });
  }, []);

  const setShowDates = useCallback((v: boolean) => {
    setState((s) => ({ ...s, showDates: v }));
    writeShowDates(v);
  }, []);

  const setShowLivingIndicator = useCallback((v: boolean) => {
    setState((s) => ({ ...s, showLivingIndicator: v }));
    writeShowLivingIndicator(v);
  }, []);

  const setShowMinimap = useCallback((v: boolean) => {
    setState((s) => ({ ...s, showMinimap: v }));
    writeShowMinimap(v);
  }, []);

  const setShowDataQuality = useCallback((v: boolean) => {
    setState((s) => ({ ...s, showDataQuality: v }));
    writeShowDataQuality(v);
  }, []);

  const setShowProposals = useCallback((v: boolean) => {
    setState((s) => ({ ...s, showProposals: v }));
    writeShowProposals(v);
  }, []);

  const setShowCitations = useCallback((v: boolean) => {
    setState((s) => ({ ...s, showCitations: v }));
    writeShowCitations(v);
  }, []);

  const setColoring = useCallback((v: Coloring) => {
    setState((s) => ({ ...s, coloring: v }));
    writeColoring(v);
  }, []);

  const setEdges = useCallback((v: EdgeStyle) => {
    setState((s) => ({ ...s, edges: v }));
    writeEdgeStyle(v);
  }, []);

  return {
    ...state,
    setShowDates,
    setShowLivingIndicator,
    setShowMinimap,
    setShowDataQuality,
    setShowProposals,
    setShowCitations,
    setColoring,
    setEdges,
  };
}
