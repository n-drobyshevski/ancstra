'use client';

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { X } from 'lucide-react';
import type { CanvasNodeData } from './canvas-utils';

type NoteNodeType = Node<CanvasNodeData, 'note'>;

function NoteNodeComponent({ data, selected, id }: NodeProps<NoteNodeType>) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.noteText ?? '');
  const [hovered, setHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  // Persist note text to localStorage on blur
  const handleBlur = useCallback(() => {
    setEditing(false);
    if (typeof window !== 'undefined') {
      const key = `canvas-note-${id}`;
      localStorage.setItem(key, text);
    }
  }, [id, text]);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`canvas-note-${id}`);
      if (stored) setText(stored);
    }
  }, [id]);

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-muted-foreground/40"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-muted-foreground/40"
      />
      <div
        className={`min-w-[150px] min-h-[100px] max-w-[240px] rounded-lg bg-amber-50 border border-amber-200 shadow-sm transition-all dark:bg-amber-950/40 dark:border-amber-800 ${
          selected ? 'ring-2 ring-indigo-500 shadow-md' : ''
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => setEditing(true)}
      >
        {/* Delete button */}
        {hovered && (
          <button
            className="absolute top-1 right-1 p-0.5 rounded-full bg-amber-200/80 hover:bg-amber-300 dark:bg-amber-800/80 dark:hover:bg-amber-700 transition-colors"
            data-delete-note={id}
          >
            <X className="size-3 text-amber-700 dark:text-amber-300" />
          </button>
        )}

        <div className="p-3">
          {editing ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleBlur}
              className="w-full min-h-[60px] resize-none bg-transparent text-[12px] text-amber-900 dark:text-amber-100 outline-none placeholder:text-amber-400"
              placeholder="Add your notes..."
              // Prevent React Flow from capturing keyboard events while editing
              onKeyDown={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-[12px] text-amber-900 dark:text-amber-100 whitespace-pre-wrap min-h-[60px]">
              {text || (
                <span className="text-amber-400 italic">Double-click to edit...</span>
              )}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export const NoteNode = memo(NoteNodeComponent);
