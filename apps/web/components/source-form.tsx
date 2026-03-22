'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Source, SourceType } from '@ancstra/shared';

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: 'vital_record', label: 'Vital Record' },
  { value: 'census', label: 'Census' },
  { value: 'military', label: 'Military' },
  { value: 'church', label: 'Church' },
  { value: 'newspaper', label: 'Newspaper' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'land', label: 'Land' },
  { value: 'probate', label: 'Probate' },
  { value: 'cemetery', label: 'Cemetery' },
  { value: 'photograph', label: 'Photograph' },
  { value: 'personal_knowledge', label: 'Personal Knowledge' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'book', label: 'Book' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

interface SourceFormProps {
  source?: Source;
  onSave?: () => void;
  onCancel?: () => void;
}

export function SourceForm({ source, onSave, onCancel }: SourceFormProps) {
  const isEdit = !!source;

  const [title, setTitle] = useState(source?.title ?? '');
  const [author, setAuthor] = useState(source?.author ?? '');
  const [publisher, setPublisher] = useState(source?.publisher ?? '');
  const [publicationDate, setPublicationDate] = useState(source?.publicationDate ?? '');
  const [repositoryName, setRepositoryName] = useState(source?.repositoryName ?? '');
  const [repositoryUrl, setRepositoryUrl] = useState(source?.repositoryUrl ?? '');
  const [sourceType, setSourceType] = useState<string>(source?.sourceType ?? '');
  const [notes, setNotes] = useState(source?.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        author: author.trim() || undefined,
        publisher: publisher.trim() || undefined,
        publicationDate: publicationDate.trim() || undefined,
        repositoryName: repositoryName.trim() || undefined,
        repositoryUrl: repositoryUrl.trim() || undefined,
        sourceType: sourceType || undefined,
        notes: notes.trim() || undefined,
      };

      const url = isEdit ? `/api/sources/${source.id}` : '/api/sources';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save source');
      }

      toast.success(isEdit ? 'Source updated' : 'Source created');
      onSave?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save source');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="source-title">Title *</Label>
          <Input
            id="source-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Source title"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-author">Author</Label>
          <Input
            id="source-author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-publisher">Publisher</Label>
          <Input
            id="source-publisher"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            placeholder="Publisher"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-pub-date">Publication Date</Label>
          <Input
            id="source-pub-date"
            value={publicationDate}
            onChange={(e) => setPublicationDate(e.target.value)}
            placeholder="e.g. 1920 or 1920-03-15"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-repo-name">Repository Name</Label>
          <Input
            id="source-repo-name"
            value={repositoryName}
            onChange={(e) => setRepositoryName(e.target.value)}
            placeholder="e.g. National Archives"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-repo-url">Repository URL</Label>
          <Input
            id="source-repo-url"
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-type">Source Type</Label>
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger id="source-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-notes">Notes</Label>
        <Textarea
          id="source-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes about this source..."
          rows={3}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Update Source' : 'Create Source'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
