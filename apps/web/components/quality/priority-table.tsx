'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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

const FIELD_KEYS = ['name', 'birthDate', 'birthPlace', 'deathDate', 'source'] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function isFieldKey(s: string): s is FieldKey {
  return (FIELD_KEYS as readonly string[]).includes(s);
}

export function PriorityTable() {
  const t = useTranslations('analytics.priorityTable');
  const tFields = useTranslations('analytics.priorityTable.fieldLabels');
  const tHeaders = useTranslations('analytics.priorityTable.headers');
  const [data, setData] = useState<PriorityResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const fetchPage = useCallback(
    (p: number) => {
      fetch(`/api/quality/priorities?page=${p}&pageSize=${pageSize}`)
        .then((res) => {
          if (!res.ok) throw new Error(t('loadFailed'));
          return res.json();
        })
        .then((result: PriorityResponse) => {
          setData(result);
          setPage(result.page);
        })
        .catch((err) => setError(err.message));
    },
    [t],
  );

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
          <CardTitle>{t('title')}</CardTitle>
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
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tHeaders('name')}</TableHead>
              <TableHead className="w-24 text-right">{tHeaders('score')}</TableHead>
              <TableHead>{tHeaders('missingFields')}</TableHead>
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
                      : t('unknown')}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono">{person.score}%</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {person.missingFields.map((field) => (
                      <Badge key={field} variant="secondary">
                        {isFieldKey(field) ? tFields(field) : field}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {data.persons.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {t('noPersons')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('pageOf', { page, total: totalPages, count: data.total })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => fetchPage(page - 1)}
              >
                {t('previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => fetchPage(page + 1)}
              >
                {t('next')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
