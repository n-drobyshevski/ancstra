'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type PrivacyLevel = 'public' | 'private' | 'restricted';
type GedcomExportMode = 'full' | 'shareable';
type CitationStyle = 'evidence-explained' | 'chicago' | 'apa';

interface Props {
  initial: {
    defaultPrivacyLevel: PrivacyLevel;
    defaultGedcomExportMode: GedcomExportMode;
    defaultCitationStyle: CitationStyle;
  };
}

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; hint: string }[] = [
  { value: 'private', label: 'Private', hint: 'Only family members see full details. Living persons stay redacted for viewers.' },
  { value: 'public', label: 'Public', hint: 'New persons are visible to anyone who can read the tree.' },
  { value: 'restricted', label: 'Restricted', hint: 'Only owner and admins see new persons by default.' },
];

const EXPORT_OPTIONS: { value: GedcomExportMode; label: string; hint: string }[] = [
  { value: 'shareable', label: 'Shareable', hint: 'Living persons redacted, suitable for sharing.' },
  { value: 'full', label: 'Full', hint: 'Includes everything in the family DB. Owner/family use only.' },
];

const CITATION_OPTIONS: { value: CitationStyle; label: string; hint: string }[] = [
  { value: 'evidence-explained', label: 'Evidence Explained', hint: 'Genealogy standard — Mills & Mills.' },
  { value: 'chicago', label: 'Chicago', hint: 'Standard humanities footnoting.' },
  { value: 'apa', label: 'APA', hint: 'Author-date scientific style.' },
];

export function EditorDefaultsForm({ initial }: Props) {
  const router = useRouter();
  const [privacy, setPrivacy] = useState<PrivacyLevel>(initial.defaultPrivacyLevel);
  const [exportMode, setExportMode] = useState<GedcomExportMode>(initial.defaultGedcomExportMode);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>(initial.defaultCitationStyle);

  const update = trpc.family.updateEditorDefaults.useMutation({
    onSuccess: ({ changed }) => {
      if (changed.length === 0) {
        toast.info('No changes to save.');
        return;
      }
      toast.success(`Saved (${changed.length} change${changed.length === 1 ? '' : 's'})`);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save defaults');
    },
  });

  const dirty =
    privacy !== initial.defaultPrivacyLevel ||
    exportMode !== initial.defaultGedcomExportMode ||
    citationStyle !== initial.defaultCitationStyle;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;
    update.mutate({
      ...(privacy !== initial.defaultPrivacyLevel ? { defaultPrivacyLevel: privacy } : {}),
      ...(exportMode !== initial.defaultGedcomExportMode ? { defaultGedcomExportMode: exportMode } : {}),
      ...(citationStyle !== initial.defaultCitationStyle ? { defaultCitationStyle: citationStyle } : {}),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New person privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="default-privacy">Default privacy level</Label>
          <Select
            value={privacy}
            onValueChange={(v) => setPrivacy(v as PrivacyLevel)}
            disabled={update.isPending}
          >
            <SelectTrigger id="default-privacy" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIVACY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {PRIVACY_OPTIONS.find((o) => o.value === privacy)?.hint}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GEDCOM export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="default-gedcom">Default export mode</Label>
          <Select
            value={exportMode}
            onValueChange={(v) => setExportMode(v as GedcomExportMode)}
            disabled={update.isPending}
          >
            <SelectTrigger id="default-gedcom" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {EXPORT_OPTIONS.find((o) => o.value === exportMode)?.hint}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Citation style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="default-citation">Default citation format</Label>
          <Select
            value={citationStyle}
            onValueChange={(v) => setCitationStyle(v as CitationStyle)}
            disabled={update.isPending}
          >
            <SelectTrigger id="default-citation" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CITATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {CITATION_OPTIONS.find((o) => o.value === citationStyle)?.hint}
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || update.isPending}>
          {update.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save defaults
            </>
          )}
        </Button>
        {dirty ? (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>
    </form>
  );
}
