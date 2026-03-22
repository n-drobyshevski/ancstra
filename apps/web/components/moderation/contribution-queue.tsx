'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContributionReview } from './contribution-review';

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

export function ContributionQueue({ familyId }: { familyId: string }) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/families/${familyId}/contributions`)
      .then((r) => r.json())
      .then((data) => {
        setContributions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [familyId]);

  if (loading)
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (contributions.length === 0) return null;

  const selected = contributions.find((c) => c.id === selectedId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Pending Reviews ({contributions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {contributions.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div>
              <span className="text-sm font-medium capitalize">
                {c.operation}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                {c.entityType}
              </span>
              <Badge variant="outline" className="ml-2">
                {c.status}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedId(c.id)}
            >
              Review
            </Button>
          </div>
        ))}
        {selected && (
          <ContributionReview
            contribution={selected}
            familyId={familyId}
            onClose={() => setSelectedId(null)}
            onReviewed={() => {
              setContributions((prev) =>
                prev.filter((c) => c.id !== selectedId)
              );
              setSelectedId(null);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
