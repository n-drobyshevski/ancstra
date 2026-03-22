'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CanvasPosition } from '@/components/research/canvas/canvas-utils';

export function useCanvasPositions(personId: string) {
  const [positions, setPositions] = useState<CanvasPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch positions on mount
  useEffect(() => {
    if (!personId) return;
    setIsLoading(true);
    fetch(
      `/api/research/canvas-positions?personId=${encodeURIComponent(personId)}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch positions: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setPositions(data.positions ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [personId]);

  // Debounced bulk save
  const savePositions = useCallback(
    (
      posData: {
        personId: string;
        nodeType: string;
        nodeId: string;
        x: number;
        y: number;
      }[],
    ) => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch('/api/research/canvas-positions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId, positions: posData }),
        }).catch(() => {
          // silent fail
        });
      }, 1500);
    },
    [personId],
  );

  // Immediate single position removal
  const removePosition = useCallback(
    (nodeType: string, nodeId: string) => {
      fetch(
        `/api/research/canvas-positions?personId=${encodeURIComponent(personId)}&nodeId=${encodeURIComponent(nodeId)}&nodeType=${encodeURIComponent(nodeType)}`,
        { method: 'DELETE' },
      ).catch(() => {
        // silent fail
      });
    },
    [personId],
  );

  return { positions, savePositions, removePosition, isLoading, error };
}
