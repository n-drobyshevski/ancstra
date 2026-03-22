'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Contribution {
  id: string;
  userId: string;
  operation: string;
  entityType: string;
  entityId: string | null;
  payload: string;
  status: string;
  createdAt: string;
}

interface ContributionReviewProps {
  contribution: Contribution;
  familyId: string;
  onClose: () => void;
  onReviewed: () => void;
}

export function ContributionReview({
  contribution,
  familyId,
  onClose,
  onReviewed,
}: ContributionReviewProps) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let parsedPayload: unknown = null;
  try {
    parsedPayload = JSON.parse(contribution.payload);
  } catch {
    parsedPayload = contribution.payload;
  }

  async function handleAction(action: 'approve' | 'reject') {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/families/${familyId}/contributions/${contribution.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, comment: comment || undefined }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }

      onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-4 border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">
          Review: <span className="capitalize">{contribution.operation}</span>{' '}
          {contribution.entityType}
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Submitted by {contribution.userId} on{' '}
            {new Date(contribution.createdAt).toLocaleDateString()}
          </p>
          {contribution.entityId && (
            <p className="text-xs text-muted-foreground">
              Entity: {contribution.entityId}
            </p>
          )}
        </div>

        <div className="rounded-md bg-muted p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Payload
          </p>
          <pre className="max-h-48 overflow-auto text-xs whitespace-pre-wrap">
            {typeof parsedPayload === 'string'
              ? parsedPayload
              : JSON.stringify(parsedPayload, null, 2)}
          </pre>
        </div>

        <Textarea
          placeholder="Optional reviewer comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleAction('approve')}
            disabled={submitting}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleAction('reject')}
            disabled={submitting}
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
