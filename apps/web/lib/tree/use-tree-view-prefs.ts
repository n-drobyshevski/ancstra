'use client';

import { useState, useCallback } from 'react';
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
  readColoringStyle,
  writeColoringStyle,
  readEdgeStyle,
  writeEdgeStyle,
  type Coloring,
  type ColoringStyle,
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
  coloringStyle: ColoringStyle;
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
  coloringStyle: 'fill',
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
  setColoringStyle: (v: ColoringStyle) => void;
  setEdges: (v: EdgeStyle) => void;
}

export function useTreeViewPrefs(): TreeViewPrefsApi {
  // Lazy initializer reads localStorage during the FIRST render. This avoids
  // a post-mount `setState` cascade that triggered "Maximum update depth"
  // when combined with the canvas's bridge effect + apply-filters effect.
  // Safe here because the only consumer (`TreeCanvas`) is `dynamic({ ssr: false })`,
  // so there is no SSR/CSR HTML to mismatch — the storage helpers return their
  // own SSR-safe `null` if `window` is somehow undefined.
  const [state, setState] = useState<TreeViewPrefs>(() => ({
    showDates: readShowDates() ?? DEFAULTS.showDates,
    showLivingIndicator: readShowLivingIndicator() ?? DEFAULTS.showLivingIndicator,
    showMinimap: readShowMinimap() ?? DEFAULTS.showMinimap,
    showDataQuality: readShowDataQuality() ?? DEFAULTS.showDataQuality,
    showProposals: readShowProposals() ?? DEFAULTS.showProposals,
    showCitations: readShowCitations() ?? DEFAULTS.showCitations,
    coloring: readColoring() ?? DEFAULTS.coloring,
    coloringStyle: readColoringStyle() ?? DEFAULTS.coloringStyle,
    edges: readEdgeStyle() ?? DEFAULTS.edges,
  }));

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

  const setColoringStyle = useCallback((v: ColoringStyle) => {
    setState((s) => ({ ...s, coloringStyle: v }));
    writeColoringStyle(v);
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
    setColoringStyle,
    setEdges,
  };
}
