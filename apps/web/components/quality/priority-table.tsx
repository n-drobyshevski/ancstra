'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PriorityPerson } from '@ancstra/db';

interface PriorityResponse {
  persons: PriorityPerson[];
  total: number;
  page: number;
  pageSize: number;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  birthDate: 'Birth Date',
  birthPlace: 'Birth Place',
  deathDate: 'Death Date',
  source: 'Source',
};

export function PriorityTable() {
  const [data, setData] = useState<PriorityResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const fetchPage = useCallback((p: number) => {
    fetch(`/api/quality/priorities?page=${p}&pageSize=${pageSize}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load priorities');
        return res.json();
      })
      .then((result: PriorityResponse) => {
        setData(result);
        setPage(result.page);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Research Priorities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research Priorities</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-24 text-right">Score</TableHead>
              <TableHead>Missing Fields</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.persons.map((person) => (
              <TableRow key={person.id}>
                <TableCell>
                  <Link
                    href={`/persons/${person.id}`}
                    className="font-medium hover:underline"
                  >
                    {person.givenName || person.surname
                      ? `${person.givenName} ${person.surname}`.trim()
                      : 'Unknown'}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono">{person.score}%</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {person.missingFields.map((field) => (
                      <Badge key={field} variant="secondary">
                        {FIELD_LABELS[field] ?? field}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {data.persons.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No persons found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({data.total} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => fetchPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => fetchPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
