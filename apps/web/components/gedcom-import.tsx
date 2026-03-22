'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { previewGedcom, commitGedcomImport } from '@/app/actions/import-gedcom';
import type { GedcomPreview } from '@/lib/gedcom/types';

export function GedcomImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [preview, setPreview] = useState<GedcomPreview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [warningsExpanded, setWarningsExpanded] = useState(false);

  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.ged')) {
      setError('Please select a .ged file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set('file', selectedFile);
      const result = await previewGedcom(formData);
      setPreview(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
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
      const formData = new FormData();
      formData.set('file', file);
      const result = await commitGedcomImport(formData);
      toast.success(
        `Imported ${result.imported.persons} persons, ${result.imported.families} families, ${result.imported.events} events`
      );
      router.push('/tree');
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
        </div>
      </CardContent>
    </Card>
  );
}
