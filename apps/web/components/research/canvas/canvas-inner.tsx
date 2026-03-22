'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { SourceNode } from './source-node';
import { NoteNode } from './note-node';
import { ConflictNode } from './conflict-node';
import { EvidenceEdge } from './evidence-edge';
import { CanvasToolbar } from './canvas-toolbar';
import { SourcePalette } from './source-palette';
import {
  buildCanvasNodes,
  buildConflictEdges,
  autoLayoutNodes,
  extractCanvasPositions,
  type CanvasNodeData,
  type CanvasPosition,
  type ResearchItemShape,
  type ConflictShape,
} from './canvas-utils';

const nodeTypes = {
  source: SourceNode,
  note: NoteNode,
  conflict: ConflictNode,
};

const edgeTypes = {
  evidence: EvidenceEdge,
};

interface CanvasInnerProps {
  personId: string;
  researchItems: ResearchItemShape[];
  positions: CanvasPosition[];
  conflicts: ConflictShape[];
}

export function CanvasInner({
  personId,
  researchItems,
  positions,
  conflicts,
}: CanvasInnerProps) {
  const { fitView, screenToFlowPosition } = useReactFlow();

  // Build initial nodes and edges
  const initialNodes = useMemo(
    () => buildCanvasNodes(researchItems, positions, conflicts),
    [researchItems, positions, conflicts],
  );

  const initialEdges = useMemo(() => {
    const conflictEdges = buildConflictEdges(conflicts, researchItems);
    // Load persisted edges from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`canvas-edges-${personId}`);
      if (stored) {
        try {
          const userEdges: Edge[] = JSON.parse(stored);
          return [...conflictEdges, ...userEdges];
        } catch {
          // ignore
        }
      }
    }
    return conflictEdges;
  }, [conflicts, researchItems, personId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [miniMapVisible, setMiniMapVisible] = useState(true);

  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced position save
  const debouncedSavePositions = useCallback(
    (currentNodes: Node[]) => {
      clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        const posData = extractCanvasPositions(currentNodes, personId);
        fetch('/api/research/canvas-positions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId, positions: posData }),
        }).catch(() => {
          // silent fail for position saves
        });
      }, 1500);
    },
    [personId],
  );

  // Persist edges to localStorage on change
  const persistEdges = useCallback(
    (currentEdges: Edge[]) => {
      if (typeof window === 'undefined') return;
      // Only persist user-created edges (not conflict auto-edges)
      const userEdges = currentEdges.filter(
        (e) => !e.id.startsWith('conflict-edge-'),
      );
      localStorage.setItem(
        `canvas-edges-${personId}`,
        JSON.stringify(userEdges),
      );
    },
    [personId],
  );

  // Handle node changes with position persistence
  const handleNodesChange: OnNodesChange<Node<CanvasNodeData>> = useCallback(
    (changes) => {
      onNodesChange(changes);
      if (
        changes.some(
          (c) => c.type === 'position' && !('dragging' in c && c.dragging),
        )
      ) {
        setNodes((currentNodes) => {
          debouncedSavePositions(currentNodes);
          return currentNodes;
        });
      }
    },
    [onNodesChange, setNodes, debouncedSavePositions],
  );

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;

      const newEdge: Edge = {
        id: `edge-${source}-${target}-${Date.now()}`,
        source,
        target,
        type: 'evidence',
        data: { relationship: 'related' },
      };

      setEdges((eds) => {
        const next = [...eds, newEdge];
        persistEdges(next);
        return next;
      });
    },
    [setEdges, persistEdges],
  );

  // Delete nodes and edges
  const handleDeleteNote = useCallback(
    (noteId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== noteId));
      setEdges((eds) => {
        const next = eds.filter(
          (e) => e.source !== noteId && e.target !== noteId,
        );
        persistEdges(next);
        return next;
      });

      // Extract nodeId from "note-xxx"
      const rawId = noteId.replace('note-', '');
      fetch(
        `/api/research/canvas-positions?personId=${encodeURIComponent(personId)}&nodeId=${encodeURIComponent(rawId)}&nodeType=note`,
        { method: 'DELETE' },
      ).catch(() => {});

      // Clean up localStorage note text
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`canvas-note-${noteId}`);
      }
    },
    [setNodes, setEdges, persistEdges, personId],
  );

  // Listen for delete-note button clicks (data-delete-note attribute)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-delete-note]') as HTMLElement | null;
      if (btn) {
        const noteId = btn.getAttribute('data-delete-note');
        if (noteId) handleDeleteNote(noteId);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [handleDeleteNote]);

  // Auto-layout
  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => {
      const laid = autoLayoutNodes(nds, edges);
      debouncedSavePositions(laid);
      return laid;
    });
  }, [edges, setNodes, debouncedSavePositions]);

  // Zoom to fit
  const handleZoomFit = useCallback(() => {
    fitView({ duration: 300, padding: 0.2 });
  }, [fitView]);

  // Add note
  const handleAddNote = useCallback(() => {
    const noteId = crypto.randomUUID();
    const newNode: Node<CanvasNodeData> = {
      id: `note-${noteId}`,
      type: 'note',
      position: { x: 100, y: 100 },
      data: {
        type: 'note',
        title: 'Note',
        noteText: '',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  // Drag-and-drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/ancstra-research');
      if (!raw) return;

      try {
        const { id, type, title, snippet, status, providerId } = JSON.parse(raw);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode: Node<CanvasNodeData> = {
          id: `${type}-${id}`,
          type: 'source',
          position,
          data: {
            type,
            title,
            snippet,
            status,
            sourceId: id,
            providerId,
          },
        };

        setNodes((nds) => {
          // Don't add duplicates
          if (nds.some((n) => n.id === newNode.id)) return nds;
          return [...nds, newNode];
        });
      } catch {
        // ignore invalid JSON
      }
    },
    [screenToFlowPosition, setNodes],
  );

  // Compute which nodes are on canvas for palette
  const nodesOnCanvas = useMemo(
    () => new Set(nodes.map((n) => n.id)),
    [nodes],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        handleAutoLayout();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleZoomFit();
      }
      if (e.key === 'n' || e.key === 'N') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          handleAddNote();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleAutoLayout, handleZoomFit, handleAddNote]);

  return (
    <div className="relative flex h-full">
      {paletteOpen && (
        <SourcePalette
          researchItems={researchItems}
          nodesOnCanvas={nodesOnCanvas}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          minZoom={0.1}
          maxZoom={2}
          deleteKeyCode="Delete"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          {miniMapVisible && (
            <MiniMap
              position="bottom-left"
              zoomable
              pannable
              className="!bg-card !border !shadow-sm !rounded-lg"
            />
          )}
          <Controls
            position="bottom-right"
            className="!bg-card !border !shadow-sm !rounded-lg"
          />
        </ReactFlow>

        <CanvasToolbar
          onAutoLayout={handleAutoLayout}
          onZoomFit={handleZoomFit}
          onAddNote={handleAddNote}
          onToggleMiniMap={() => setMiniMapVisible((v) => !v)}
          miniMapVisible={miniMapVisible}
          onTogglePalette={() => setPaletteOpen((v) => !v)}
          paletteOpen={paletteOpen}
        />
      </div>
    </div>
  );
}
