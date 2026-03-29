'use client';

import { useEffect, useRef } from 'react';
import type { DraftFact } from './types';

const DEFAULT_COLOR = 'rgb(168 85 247)';

/**
 * Highlights extracted text ranges in a plain text container or iframe srcDoc.
 * Uses TreeWalker to find text nodes and wraps matching ranges with <mark> elements.
 */
export function useTextHighlighter(
  facts: DraftFact[],
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  plainTextRef: React.RefObject<HTMLDivElement | null>,
  accentColor: string = DEFAULT_COLOR,
) {
  // Track marks we've injected so we can clean them up
  const marksRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    // Clean up previous marks
    for (const mark of marksRef.current) {
      const parent = mark.parentNode;
      if (parent) {
        // Replace mark with its text content
        const text = document.createTextNode(mark.textContent ?? '');
        parent.replaceChild(text, mark);
        parent.normalize();
      }
    }
    marksRef.current = [];

    // Get ranges to highlight (only facts with textRange)
    const ranges = facts
      .filter((f) => f.textRange !== null)
      .map((f) => f.textRange!)
      .sort((a, b) => b.start - a.start); // reverse order so offsets stay valid

    if (ranges.length === 0) return;

    // Apply to plain text container
    if (plainTextRef.current) {
      applyHighlights(plainTextRef.current, ranges, accentColor, marksRef.current);
    }

    // Apply to iframe
    if (iframeRef.current?.contentDocument?.body) {
      applyHighlights(iframeRef.current.contentDocument.body, ranges, accentColor, marksRef.current);
    }
  }, [facts, iframeRef, plainTextRef, accentColor]);
}

function applyHighlights(
  root: HTMLElement,
  ranges: { start: number; end: number }[],
  color: string,
  trackedMarks: HTMLElement[],
) {
  // Build a flat list of text nodes with their character offsets
  const textNodes: { node: Text; start: number; end: number }[] = [];
  let offset = 0;

  const walker = (root.ownerDocument ?? document).createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );

  let current = walker.nextNode();
  while (current) {
    const len = current.textContent?.length ?? 0;
    textNodes.push({ node: current as Text, start: offset, end: offset + len });
    offset += len;
    current = walker.nextNode();
  }

  // For each range, find overlapping text nodes and wrap them
  for (const range of ranges) {
    for (const tn of textNodes) {
      // Check overlap
      const overlapStart = Math.max(range.start, tn.start);
      const overlapEnd = Math.min(range.end, tn.end);

      if (overlapStart >= overlapEnd) continue;

      // Split the text node to isolate the highlighted portion
      const relStart = overlapStart - tn.start;
      const relEnd = overlapEnd - tn.start;

      const textContent = tn.node.textContent ?? '';

      // Create 3 nodes: before, mark, after
      const before = textContent.slice(0, relStart);
      const highlighted = textContent.slice(relStart, relEnd);
      const after = textContent.slice(relEnd);

      const doc = tn.node.ownerDocument;
      const mark = doc.createElement('mark');
      mark.textContent = highlighted;
      mark.style.backgroundColor = `color-mix(in srgb, ${color} 15%, transparent)`;
      mark.style.borderBottom = `2px solid ${color}`;
      mark.style.padding = '0 1px';
      mark.style.borderRadius = '2px';
      mark.dataset.extractedFact = 'true';

      const parent = tn.node.parentNode;
      if (!parent) continue;

      const frag = doc.createDocumentFragment();
      if (before) frag.appendChild(doc.createTextNode(before));
      frag.appendChild(mark);
      if (after) frag.appendChild(doc.createTextNode(after));

      parent.replaceChild(frag, tn.node);
      trackedMarks.push(mark);

      // Update the textNodes array for subsequent ranges
      // (since we're iterating ranges in reverse order, earlier ranges
      // won't be affected by DOM changes from later ranges)
      break; // Only highlight the first matching text node for each range
    }
  }
}
