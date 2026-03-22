import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Person } from '@ancstra/shared';

const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

export function PersonDetail({ person }: { person: Person }) {
  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">
            {person.prefix ? `${person.prefix} ` : ''}
            {person.givenName} {person.surname}
            {person.suffix ? ` ${person.suffix}` : ''}
          </h1>
          <Badge variant="secondary">{sexLabel[person.sex]}</Badge>
          {person.isLiving && <Badge>Living</Badge>}
        </div>
        <Button variant="outline" disabled>
          Edit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vital Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(person.birthDate || person.birthPlace) && (
            <div>
              <span className="font-medium">Birth:</span>{' '}
              {[person.birthDate, person.birthPlace].filter(Boolean).join(', ')}
            </div>
          )}
          {(person.deathDate || person.deathPlace) && (
            <div>
              <span className="font-medium">Death:</span>{' '}
              {[person.deathDate, person.deathPlace].filter(Boolean).join(', ')}
            </div>
          )}
          {!person.birthDate && !person.birthPlace && !person.deathDate && !person.deathPlace && (
            <p className="text-muted-foreground">No vital events recorded.</p>
          )}
        </CardContent>
      </Card>

      {person.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{person.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground">
        Created: {new Date(person.createdAt).toLocaleDateString()} | Updated:{' '}
        {new Date(person.updatedAt).toLocaleDateString()}
      </div>

      <Button variant="outline" asChild>
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
