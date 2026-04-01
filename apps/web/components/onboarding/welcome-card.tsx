'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { X } from 'lucide-react';

const DISMISSED_KEY = 'ancstra-welcome-dismissed';

export function WelcomeCard() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
  }, []);

  if (dismissed) return null;

  return (
    <Card className="relative border-primary/20 bg-primary/5">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2"
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, 'true');
          setDismissed(true);
        }}
        aria-label="Dismiss welcome message"
      >
        <X className="h-4 w-4" />
      </Button>
      <CardHeader>
        <CardTitle>Welcome to Ancstra!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">Here&apos;s how to get started:</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/data">Import a GEDCOM file</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/persons/new">Add a person</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/research">AI Research</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
