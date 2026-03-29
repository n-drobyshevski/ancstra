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
        className={`min-w-[150px] min-h-[100px] max-w-[240px] rounded-lg bg-primary/5 border border-primary/20 shadow-sm transition-all dark:bg-primary/10 dark:border-primary/30 ${
          selected ? 'ring-2 ring-primary shadow-md' : ''
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => setEditing(true)}
      >
        {/* Delete button */}
        {hovered && (
          <button
            className="absolute top-1 right-1 p-0.5 rounded-full bg-primary/15 hover:bg-primary/25 dark:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
            data-delete-note={id}
          >
            <X className="size-3 text-primary dark:text-primary/80" />
          </button>
        )}

        <div className="p-3">
          {editing ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleBlur}
              className="w-full min-h-[60px] resize-none bg-transparent text-[12px] text-foreground dark:text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Add your notes..."
              // Prevent React Flow from capturing keyboard events while editing
              onKeyDown={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-[12px] text-foreground dark:text-foreground whitespace-pre-wrap min-h-[60px]">
              {text || (
                <span className="text-muted-foreground italic">Double-click to edit...</span>
              )}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export const NoteNode = memo(NoteNodeComponent);
