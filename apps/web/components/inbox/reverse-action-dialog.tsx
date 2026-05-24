'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface ReverseActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  diff?: React.ReactNode;
  actionLabel: string;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

export function ReverseActionDialog({
  open, onOpenChange, title, description, diff, actionLabel, destructive, onConfirm,
}: ReverseActionDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open]);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= 1 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {diff && <div className="my-4 rounded-md border bg-muted/40 p-3 text-sm">{diff}</div>}
        <div className="space-y-2">
          <Label htmlFor="reverse-reason">Reason (required)</Label>
          <Textarea
            ref={textareaRef}
            id="reverse-reason"
            placeholder="Why are you reverting this?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? 'Working…' : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
