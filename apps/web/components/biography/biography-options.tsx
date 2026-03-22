'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type BiographyTone = 'formal' | 'conversational' | 'storytelling';
export type BiographyLength = 'brief' | 'standard' | 'detailed';
export type BiographyFocus =
  | 'life-overview'
  | 'immigration'
  | 'military'
  | 'family-life'
  | 'career';

export interface BiographyOptionsResult {
  tone: BiographyTone;
  length: BiographyLength;
  focus: BiographyFocus;
}

interface BiographyOptionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (options: BiographyOptionsResult) => void;
  generating?: boolean;
}

const TONE_OPTIONS: { value: BiographyTone; label: string }[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'storytelling', label: 'Storytelling' },
];

const LENGTH_OPTIONS: { value: BiographyLength; label: string }[] = [
  { value: 'brief', label: 'Brief' },
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
];

const FOCUS_OPTIONS: { value: BiographyFocus; label: string }[] = [
  { value: 'life-overview', label: 'Life Overview' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'military', label: 'Military' },
  { value: 'family-life', label: 'Family Life' },
  { value: 'career', label: 'Career' },
];

export function BiographyOptions({
  open,
  onOpenChange,
  onGenerate,
  generating = false,
}: BiographyOptionsProps) {
  const [tone, setTone] = useState<BiographyTone>('conversational');
  const [length, setLength] = useState<BiographyLength>('standard');
  const [focus, setFocus] = useState<BiographyFocus>('life-overview');

  function handleGenerate() {
    onGenerate({ tone, length, focus });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Biography</DialogTitle>
          <DialogDescription>
            Choose how you would like the biography to be written.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select
              value={tone}
              onValueChange={(v) => setTone(v as BiographyTone)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Length</Label>
            <Select
              value={length}
              onValueChange={(v) => setLength(v as BiographyLength)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENGTH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Focus</Label>
            <Select
              value={focus}
              onValueChange={(v) => setFocus(v as BiographyFocus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOCUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Estimated cost: ~$0.02 per generation
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generating}
          >
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
