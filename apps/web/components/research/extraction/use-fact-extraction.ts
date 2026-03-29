'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { suggestFactType, getSurroundingContext } from './suggest-type';
import type {
  DraftFact,
  ExtractionSession,
  ContextMenuState,
  FactType,
} from './types';

const EMPTY_MENU: ContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  selectedText: '',
  suggestedType: null,
  textRange: null,
};

interface UseFactExtractionOptions {
  researchItemId: string;
  researchItemTitle: string;
}

export function useFactExtraction({ researchItemId, researchItemTitle }: UseFactExtractionOptions) {
  const [session, setSession] = useState<ExtractionSession>({
    factsheetId: null,
    factsheetTitle: researchItemTitle,
    researchItemId,
    facts: [],
  });

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(EMPTY_MENU);
  const [panelVisible, setPanelVisible] = useState(false);

  // Refs for iframe access
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const plainTextRef = useRef<HTMLDivElement>(null);

  // --- Context menu handlers ---

  const handleContextMenu = useCallback((e: MouseEvent, source: 'iframe' | 'plaintext') => {
    let selection = '';
    let textRange: { start: number; end: number } | null = null;

    if (source === 'iframe' && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      const sel = doc.getSelection();
      selection = sel?.toString().trim() ?? '';

      // Try to get text offset for highlighting
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const body = doc.body;
        const fullText = body.textContent ?? '';
        const preRange = doc.createRange();
        preRange.selectNodeContents(body);
        preRange.setEnd(range.startContainer, range.startOffset);
        const start = preRange.toString().length;
        textRange = { start, end: start + selection.length };
      }
    } else {
      const sel = window.getSelection();
      selection = sel?.toString().trim() ?? '';

      if (sel && sel.rangeCount > 0 && plainTextRef.current) {
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(plainTextRef.current);
        preRange.setEnd(range.startContainer, range.startOffset);
        const start = preRange.toString().length;
        textRange = { start, end: start + selection.length };
      }
    }

    if (!selection) return;

    e.preventDefault();

    // Calculate position relative to the viewport
    let x = e.clientX;
    let y = e.clientY;

    if (source === 'iframe' && iframeRef.current) {
      const rect = iframeRef.current.getBoundingClientRect();
      x += rect.left;
      y += rect.top;
    }

    // Get surrounding context for type suggestion
    let surroundingText = '';
    if (textRange) {
      const fullText = source === 'iframe'
        ? (iframeRef.current?.contentDocument?.body.textContent ?? '')
        : (plainTextRef.current?.textContent ?? '');
      surroundingText = getSurroundingContext(fullText, textRange.start, textRange.end);
    }

    const suggestedType = suggestFactType(surroundingText);

    setContextMenu({
      visible: true,
      x,
      y,
      selectedText: selection,
      suggestedType,
      textRange,
    });
  }, []);

  const dismissMenu = useCallback(() => {
    setContextMenu(EMPTY_MENU);
  }, []);

  // --- Attach listeners to iframe document ---

  const attachIframeListeners = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const tryAttach = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      doc.addEventListener('contextmenu', (e) => handleContextMenu(e, 'iframe'));
      // Dismiss menu on click inside iframe
      doc.addEventListener('click', dismissMenu);
    };

    // Attach after load
    iframe.addEventListener('load', tryAttach);
    // Also try immediately (for already-loaded iframes)
    tryAttach();

    return () => {
      iframe.removeEventListener('load', tryAttach);
      const doc = iframe.contentDocument;
      if (doc) {
        doc.removeEventListener('contextmenu', (e) => handleContextMenu(e, 'iframe'));
        doc.removeEventListener('click', dismissMenu);
      }
    };
  }, [handleContextMenu, dismissMenu]);

  // --- Attach listeners to plain text container ---

  useEffect(() => {
    const el = plainTextRef.current;
    if (!el) return;

    const handler = (e: Event) => handleContextMenu(e as MouseEvent, 'plaintext');
    el.addEventListener('contextmenu', handler);
    el.addEventListener('click', dismissMenu);

    return () => {
      el.removeEventListener('contextmenu', handler);
      el.removeEventListener('click', dismissMenu);
    };
  }, [handleContextMenu, dismissMenu]);

  // Dismiss on Escape
  useEffect(() => {
    if (!contextMenu.visible) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissMenu();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [contextMenu.visible, dismissMenu]);

  // --- Fact CRUD ---

  const addFact = useCallback((factType: FactType) => {
    if (!contextMenu.selectedText) return;

    const draft: DraftFact = {
      id: crypto.randomUUID(),
      factType,
      factValue: contextMenu.selectedText,
      selectedText: contextMenu.selectedText,
      textRange: contextMenu.textRange,
      confidence: 'medium',
      addedAt: Date.now(),
    };

    setSession((prev) => ({
      ...prev,
      facts: [...prev.facts, draft],
    }));

    if (!panelVisible) setPanelVisible(true);
    dismissMenu();
  }, [contextMenu, panelVisible, dismissMenu]);

  const removeFact = useCallback((factId: string) => {
    setSession((prev) => ({
      ...prev,
      facts: prev.facts.filter((f) => f.id !== factId),
    }));
  }, []);

  const updateDraftFact = useCallback((factId: string, updates: Partial<Pick<DraftFact, 'factType' | 'factValue' | 'confidence'>>) => {
    setSession((prev) => ({
      ...prev,
      facts: prev.facts.map((f) =>
        f.id === factId ? { ...f, ...updates } : f
      ),
    }));
  }, []);

  const clearAllFacts = useCallback(() => {
    setSession((prev) => ({ ...prev, facts: [] }));
  }, []);

  const updateFactsheetTitle = useCallback((title: string) => {
    setSession((prev) => ({ ...prev, factsheetTitle: title }));
  }, []);

  const setFactsheetId = useCallback((id: string) => {
    setSession((prev) => ({ ...prev, factsheetId: id }));
  }, []);

  return {
    session,
    contextMenu,
    panelVisible,
    setPanelVisible,
    iframeRef,
    plainTextRef,
    attachIframeListeners,
    addFact,
    removeFact,
    updateDraftFact,
    clearAllFacts,
    updateFactsheetTitle,
    setFactsheetId,
    dismissMenu,
    hasUnsavedFacts: session.facts.length > 0,
  };
}
