'use client';

import { memo, useRef, useEffect, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('tree.draftPerson');
  const tSex = useTranslations('tree.draftPerson.sexOptions');
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
      toast.error(t('nameRequired'));
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
        toast.error(t('createFailed'));
        return;
      }
      const person = await res.json();
      d.onSave(person.id);
    } catch {
      toast.error(t('networkError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-[240px] rounded-lg border-2 border-dashed border-primary/40 bg-card p-2.5 shadow-sm space-y-2">
      <Input
        ref={inputRef}
        placeholder={t('givenNamePlaceholder')}
        value={givenName}
        onChange={(e) => setGivenName(e.target.value)}
        className="h-7 text-xs"
      />
      <Input
        placeholder={t('surnamePlaceholder')}
        value={surname}
        onChange={(e) => setSurname(e.target.value)}
        className="h-7 text-xs"
      />
      <select
        value={sex}
        onChange={(e) => setSex(e.target.value)}
        className="w-full h-7 rounded border border-input bg-transparent text-xs px-2"
      >
        <option value="M">{tSex('M')}</option>
        <option value="F">{tSex('F')}</option>
        <option value="U">{tSex('U')}</option>
      </select>
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-6 text-xs flex-1"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('saving') : t('save')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs flex-1"
          onClick={() => d.onCancel()}
        >
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}

export const DraftPersonNode = memo(DraftPersonNodeComponent);
