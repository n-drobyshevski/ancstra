'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/client';
import type { GedcomPreview } from '@/lib/gedcom/types';
import { RoleGate } from '@/components/auth/role-gate';

/** Read a File as a base64 string (data URL prefix stripped). Works for any file size. */
async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip "data:<mime>;base64," prefix
      resolve(dataUrl.split(',', 2)[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface GedcomImportProps {
  /**
   * Path to navigate to after a successful commit. Defaults to `/tree`. The
   * onboarding wizard overrides this to `/dashboard?family={id}` so a freshly
   * created family lands on its own dashboard rather than the global tree view.
   */
  redirectAfterImport?: string;
  /**
   * If true, finish the import via a full page navigation (window.location)
   * instead of router.push. The onboarding wizard sets this so the proxy
   * can re-resolve memberships server-side after a fresh family.create —
   * router.push retains the stale client-side session, leaving role-gated
   * UI broken on the destination.
   */
  hardRedirect?: boolean;
}

export function GedcomImport({
  redirectAfterImport = '/tree',
  hardRedirect = false,
}: GedcomImportProps = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [preview, setPreview] = useState<GedcomPreview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [warningsExpanded, setWarningsExpanded] = useState(false);

  const previewMutation = trpc.gedcom.previewImport.useMutation();
  const commitMutation = trpc.gedcom.commitImport.useMutation();

  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.ged')) {
      setError('Please select a .ged file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const gedcomBase64 = await fileToBase64(selectedFile);
      const result = await previewMutation.mutateAsync({
        gedcomBase64,
        filename: selectedFile.name,
      });
      setPreview(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  }

  function resetWizard() {
    setStep('upload');
    setPreview(null);
    setFile(null);
    setError(null);
    setLoading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleImport() {
    if (!file) return;

    setStep('importing');
    try {
      const gedcomBase64 = await fileToBase64(file);
      const result = await commitMutation.mutateAsync({
        gedcomBase64,
        filename: file.name,
      });
      toast.success(
        `Imported ${result.imported.persons} persons, ${result.imported.families} families, ${result.imported.events} events`
      );
      if (hardRedirect) {
        window.location.href = redirectAfterImport;
      } else {
        router.push(redirectAfterImport);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }

  // Step 1: Upload
  if (step === 'upload') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload GEDCOM File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            {loading ? (
              <div className="space-y-2">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
                <p className="text-sm text-muted-foreground">Parsing file...</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">
                  Drop a .ged file here, or click to browse
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  GEDCOM 5.5 / 5.5.1 supported
                </p>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".ged"
            className="hidden"
            onChange={handleInputChange}
          />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Step 2: Preview / Importing
  if (!preview) return null;

  const { stats, warnings, existingPersonCount } = preview;
  const visibleWarnings = warningsExpanded ? warnings : warnings.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview Import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary">{stats.persons} persons</Badge>
          <Badge variant="secondary">{stats.families} families</Badge>
          <Badge variant="secondary">{stats.events} events</Badge>
        </div>

        {/* Skipped sources */}
        {stats.skippedSources > 0 && (
          <p className="text-sm text-muted-foreground">
            {stats.skippedSources} source{stats.skippedSources !== 1 ? 's' : ''} will be skipped
          </p>
        )}

        {/* Existing persons notice */}
        {existingPersonCount > 0 && (
          <p className="text-sm text-muted-foreground">
            You already have {existingPersonCount} person{existingPersonCount !== 1 ? 's' : ''} (import adds alongside, not merge)
          </p>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-0.5">
              {visibleWarnings.map((w, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  [{w.type}] {w.message}
                  {w.xref ? ` (${w.xref})` : ''}
                </p>
              ))}
            </div>
            {warnings.length > 5 && (
              <button
                type="button"
                onClick={() => setWarningsExpanded(!warningsExpanded)}
                className="text-xs text-primary hover:underline"
              >
                {warningsExpanded
                  ? 'Show fewer'
                  : `Show all ${warnings.length} warnings`}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={resetWizard}
            disabled={step === 'importing'}
          >
            Cancel
          </Button>
          <RoleGate permission="gedcom:import">
            <Button
              onClick={handleImport}
              disabled={step === 'importing'}
            >
              {step === 'importing' ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Importing...
                </span>
              ) : (
                `Import ${stats.persons} persons`
              )}
            </Button>
          </RoleGate>
        </div>
      </CardContent>
    </Card>
  );
}
