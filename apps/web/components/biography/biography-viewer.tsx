'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Pencil, RefreshCw } from 'lucide-react';

interface BiographyViewerProps {
  text: string;
  onRegenerate: () => void;
  onTextChange?: (text: string) => void;
}

export function BiographyViewer({
  text,
  onRegenerate,
  onTextChange,
}: BiographyViewerProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  function handleSaveEdit() {
    onTextChange?.(editText);
    setEditing(false);
  }

  function handleCancelEdit() {
    setEditText(text);
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditText(text);
            setEditing(!editing);
          }}
        >
          <Pencil className="mr-1 h-3 w-3" />
          {editing ? 'Cancel' : 'Edit'}
        </Button>
        <Button variant="outline" size="sm" onClick={onRegenerate}>
          <RefreshCw className="mr-1 h-3 w-3" />
          Regenerate
        </Button>
        <Button variant="outline" size="sm" disabled>
          <FileText className="mr-1 h-3 w-3" />
          Export as PDF
        </Button>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={12}
            className="font-serif leading-relaxed"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit}>
              Save Changes
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancelEdit}>
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {text.split('\n\n').map((paragraph, i) => (
              <p
                key={i}
                className="font-serif text-sm leading-relaxed text-foreground"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
