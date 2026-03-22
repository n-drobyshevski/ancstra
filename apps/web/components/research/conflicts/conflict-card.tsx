'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CONFIDENCE_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  high: { label: 'High', variant: 'default' },
  medium: { label: 'Medium', variant: 'secondary' },
  low: { label: 'Low', variant: 'destructive' },
};

export interface ConflictFact {
  id: string;
  factValue: string;
  confidence: string;
  sourceTitle?: string;
}

interface ConflictCardProps {
  factType: string;
  factA: ConflictFact;
  factB: ConflictFact;
  onResolve: (winnerFactId: string, loserFactId: string) => void;
  isResolving?: boolean;
}

export function ConflictCard({
  factType,
  factA,
  factB,
  onResolve,
  isResolving,
}: ConflictCardProps) {
  const confA = CONFIDENCE_BADGE[factA.confidence] ?? CONFIDENCE_BADGE.medium;
  const confB = CONFIDENCE_BADGE[factB.confidence] ?? CONFIDENCE_BADGE.medium;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{factType}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Value A */}
          <div className="space-y-1.5 rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium">{factA.factValue}</p>
            {factA.sourceTitle && (
              <p className="text-xs text-muted-foreground truncate">
                {factA.sourceTitle}
              </p>
            )}
            <Badge variant={confA.variant} className="text-[10px]">
              {confA.label}
            </Badge>
          </div>

          {/* Value B */}
          <div className="space-y-1.5 rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium">{factB.factValue}</p>
            {factB.sourceTitle && (
              <p className="text-xs text-muted-foreground truncate">
                {factB.sourceTitle}
              </p>
            )}
            <Badge variant={confB.variant} className="text-[10px]">
              {confB.label}
            </Badge>
          </div>
        </div>

        {/* Resolution buttons */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isResolving}
            onClick={() => onResolve(factA.id, factB.id)}
          >
            Accept A
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isResolving}
            onClick={() => onResolve(factB.id, factA.id)}
          >
            Accept B
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            disabled={isResolving}
            onClick={() => onResolve(factA.id, factB.id)}
          >
            Mark Both Disputed
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
