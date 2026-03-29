'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatrixConclusionCellProps {
  factType: string;
  value: string;
  onChange: (factType: string, value: string) => void;
}

export function MatrixConclusionCell({
  factType,
  value,
  onChange,
}: MatrixConclusionCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(factType, newValue);
      }, 500);
    },
    [factType, onChange],
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange(factType, localValue);
  }, [factType, localValue, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleBlur();
      }
      if (e.key === 'Escape') {
        setLocalValue(value);
        setIsEditing(false);
      }
    },
    [handleBlur, value],
  );

  return (
    <td
      className={cn(
        'px-3 py-2 min-w-[180px] bg-status-info-bg',
        'sticky right-0 z-10',
      )}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={(e) => {
            handleChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[28px] text-sm bg-transparent border border-status-info-bg rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          rows={1}
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="w-full text-left flex items-center gap-1 group min-h-[28px]"
        >
          {localValue ? (
            <span className="text-sm text-foreground">{localValue}</span>
          ) : (
            <span className="text-xs text-muted-foreground/50 flex items-center gap-1">
              <Pencil className="size-3" />
              Add conclusion
            </span>
          )}
        </button>
      )}
    </td>
  );
}
