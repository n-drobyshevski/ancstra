'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
type CitationKey = 'evidenceExplained' | 'chicago' | 'apa';

interface Props {
  initial: {
    defaultPrivacyLevel: PrivacyLevel;
    defaultGedcomExportMode: GedcomExportMode;
    defaultCitationStyle: CitationStyle;
  };
}

const PRIVACY_VALUES: PrivacyLevel[] = ['private', 'public', 'restricted'];
const EXPORT_VALUES: GedcomExportMode[] = ['shareable', 'full'];
const CITATION_VALUES: { value: CitationStyle; key: CitationKey }[] = [
  { value: 'evidence-explained', key: 'evidenceExplained' },
  { value: 'chicago', key: 'chicago' },
  { value: 'apa', key: 'apa' },
];

export function EditorDefaultsForm({ initial }: Props) {
  const router = useRouter();
  const t = useTranslations('settings.editorDefaults.form');
  const tPrivacy = useTranslations('settings.editorDefaults.form.privacyOptions');
  const tExport = useTranslations('settings.editorDefaults.form.gedcomOptions');
  const tCitation = useTranslations('settings.editorDefaults.form.citationOptions');
  const [privacy, setPrivacy] = useState<PrivacyLevel>(initial.defaultPrivacyLevel);
  const [exportMode, setExportMode] = useState<GedcomExportMode>(initial.defaultGedcomExportMode);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>(initial.defaultCitationStyle);

  const update = trpc.family.updateEditorDefaults.useMutation({
    onSuccess: ({ changed }) => {
      if (changed.length === 0) {
        toast.info(t('noChanges'));
        return;
      }
      toast.success(t('saved', { count: changed.length }));
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || t('saveFailed'));
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

  const citationKey = CITATION_VALUES.find((c) => c.value === citationStyle)!.key;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('privacyHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="default-privacy">{t('privacyLabel')}</Label>
          <Select
            value={privacy}
            onValueChange={(v) => setPrivacy(v as PrivacyLevel)}
            disabled={update.isPending}
          >
            <SelectTrigger id="default-privacy" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIVACY_VALUES.map((v) => (
                <SelectItem key={v} value={v}>
                  {tPrivacy(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {tPrivacy(`${privacy}Hint` as const)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('gedcomHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="default-gedcom">{t('gedcomLabel')}</Label>
          <Select
            value={exportMode}
            onValueChange={(v) => setExportMode(v as GedcomExportMode)}
            disabled={update.isPending}
          >
            <SelectTrigger id="default-gedcom" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_VALUES.map((v) => (
                <SelectItem key={v} value={v}>
                  {tExport(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {tExport(`${exportMode}Hint` as const)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('citationHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="default-citation">{t('citationLabel')}</Label>
          <Select
            value={citationStyle}
            onValueChange={(v) => setCitationStyle(v as CitationStyle)}
            disabled={update.isPending}
          >
            <SelectTrigger id="default-citation" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CITATION_VALUES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {tCitation(c.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {tCitation(`${citationKey}Hint` as const)}
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || update.isPending}>
          {update.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <Save className="size-4" />
              {t('save')}
            </>
          )}
        </Button>
        {dirty ? (
          <span className="text-xs text-muted-foreground">{t('unsaved')}</span>
        ) : null}
      </div>
    </form>
  );
}
