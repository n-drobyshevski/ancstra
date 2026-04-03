'use client';

import { useState, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface ExtractedFact {
  factType: string;
  factValue: string;
  confidence: 'high' | 'medium' | 'low';
}

const DOCUMENT_TYPES = [
  { value: 'obituary', label: 'Obituary' },
  { value: 'census', label: 'Census Record' },
  { value: 'will', label: 'Will / Probate' },
  { value: 'deed', label: 'Deed / Land Record' },
  { value: 'newspaper', label: 'Newspaper Article' },
  { value: 'letter', label: 'Letter / Correspondence' },
  { value: 'other', label: 'Other' },
] as const;

const CONFIDENCE_COLORS: Record<string, 'default' | 'secondary' | 'outline'> = {
  high: 'default',
  medium: 'secondary',
  low: 'outline',
};

type ModalStep = 'input' | 'saving' | 'extracting' | 'results' | 'bookmarked' | 'error';

interface TextPasteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookmark?: () => void;
  personId?: string;
}

export function TextPasteModal({ open, onOpenChange, onBookmark, personId }: TextPasteModalProps) {
  const [text, setText] = useState('');
  const [documentType, setDocumentType] = useState<string>('');
  const [step, setStep] = useState<ModalStep>('input');
  const [facts, setFacts] = useState<ExtractedFact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bookmarkItemId, setBookmarkItemId] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setText('');
    setDocumentType('');
    setStep('input');
    setFacts([]);
    setError(null);
    setBookmarkItemId(null);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  }, [onOpenChange, resetState]);

  const handleBookmark = useCallback(async () => {
    if (!text.trim()) return;

    setStep('saving');
    setError(null);

    try {
      // Save as research item
      const res = await fetch('/api/research/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          documentType: documentType || undefined,
          personId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Save failed (${res.status})` }));
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }

      const item = await res.json();
      setBookmarkItemId(item.id);

      // Attempt AI extraction
      setStep('extracting');

      const extractRes = await fetch('/api/research/facts/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          documentType: documentType || undefined,
        }),
      });

      if (extractRes.ok) {
        const extractData = await extractRes.json();
        if (extractData.facts && extractData.facts.length > 0) {
          setFacts(extractData.facts);
          setStep('results');
          return;
        }
      }

      // AI extraction not available or returned no facts -- still a success
      setStep('bookmarked');
      onBookmark?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save text');
      setStep('error');
    }
  }, [text, documentType, personId, onBookmark]);

  const handleExtract = useCallback(async () => {
    setStep('extracting');
    setError(null);

    try {
      const res = await fetch('/api/research/facts/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          documentType: documentType || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Extraction failed (${res.status})` }));
        throw new Error(body.error ?? `Extraction failed (${res.status})`);
      }

      const data = await res.json();
      setFacts(data.facts ?? []);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI extraction failed');
      setStep('error');
    }
  }, [text, documentType]);

  const handleConfirmResults = useCallback(() => {
    setStep('bookmarked');
    onBookmark?.();
  }, [onBookmark]);

  const isProcessing = step === 'saving' || step === 'extracting';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste Text</DialogTitle>
          <DialogDescription>
            Paste document text to bookmark as a research item and extract genealogical facts.
          </DialogDescription>
        </DialogHeader>

        {/* Input step */}
        {step === 'input' && (
          <div className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste document text..."
              rows={4}
              className="min-h-[120px] resize-y"
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="doc-type-select">
                Document type
              </label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="w-full" id="doc-type-select">
                  <SelectValue placeholder="Select type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Processing step */}
        {isProcessing && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {step === 'saving' ? 'Bookmarking...' : 'Extracting facts with AI...'}
            </p>
          </div>
        )}

        {/* Results step */}
        {step === 'results' && facts.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Extracted {facts.length} fact{facts.length !== 1 ? 's' : ''}:
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {facts.map((fact, i) => (
                <div
                  key={`${fact.factType}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      {fact.factType.replace(/_/g, ' ')}
                    </span>
                    <p className="text-sm truncate">{fact.factValue}</p>
                  </div>
                  <Badge variant={CONFIDENCE_COLORS[fact.confidence] ?? 'outline'}>
                    {fact.confidence}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bookmarked step */}
        {step === 'bookmarked' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="size-8 text-green-500" />
            <p className="text-sm font-medium">Bookmarked</p>
          </div>
        )}

        {/* Error step */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle className="size-6 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <Button onClick={handleBookmark} disabled={!text.trim()}>
              Bookmark & Extract
            </Button>
          )}
          {step === 'results' && (
            <Button onClick={handleConfirmResults}>
              Done
            </Button>
          )}
          {step === 'bookmarked' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
          {step === 'error' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
                Try Again
              </Button>
              {bookmarkItemId && (
                <Button variant="outline" onClick={() => { setStep('bookmarked'); onBookmark?.(); }}>
                  Keep Bookmark
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
