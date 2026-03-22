'use client';

import { memo, useRef, useEffect, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DraftNodeData {
  onSave: (personId: string) => void;
  onCancel: () => void;
  [key: string]: unknown;
}

function DraftPersonNodeComponent({ data }: NodeProps) {
  const d = data as DraftNodeData;
  const inputRef = useRef<HTMLInputElement>(null);
  const [givenName, setGivenName] = useState('');
  const [surname, setSurname] = useState('');
  const [sex, setSex] = useState('U');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSave() {
    if (!givenName.trim() || !surname.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ givenName, surname, sex, isLiving: true }),
      });
      if (!res.ok) {
        toast.error('Failed to create person');
        return;
      }
      const person = await res.json();
      d.onSave(person.id);
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-[200px] rounded-lg border-2 border-dashed border-primary/40 bg-card p-2.5 shadow-sm space-y-2">
      <Input
        ref={inputRef}
        placeholder="Given name"
        value={givenName}
        onChange={(e) => setGivenName(e.target.value)}
        className="h-7 text-xs"
      />
      <Input
        placeholder="Surname"
        value={surname}
        onChange={(e) => setSurname(e.target.value)}
        className="h-7 text-xs"
      />
      <select
        value={sex}
        onChange={(e) => setSex(e.target.value)}
        className="w-full h-7 rounded border border-input bg-transparent text-xs px-2"
      >
        <option value="M">Male</option>
        <option value="F">Female</option>
        <option value="U">Unknown</option>
      </select>
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-6 text-xs flex-1"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '...' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs flex-1"
          onClick={() => d.onCancel()}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export const DraftPersonNode = memo(DraftPersonNodeComponent);
