'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { X } from 'lucide-react';
import { RoleGate } from '@/components/auth/role-gate';

const DISMISSED_KEY = 'ancstra-welcome-dismissed';

export function WelcomeCard() {
  const [dismissed, setDismissed] = useState(true);
  const t = useTranslations('dashboard.welcomeCard');

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
        aria-label={t('dismiss')}
      >
        <X className="h-4 w-4" />
      </Button>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('tagline')}</p>
        <div className="flex flex-wrap gap-2">
          <RoleGate permission="gedcom:import">
            <Button asChild size="sm">
              <Link href="/data">{t('importGedcom')}</Link>
            </Button>
          </RoleGate>
          <RoleGate permission="person:create">
            <Button asChild size="sm" variant="outline">
              <Link href="/persons/new">{t('addPerson')}</Link>
            </Button>
          </RoleGate>
          <RoleGate permission="ai:research">
            <Button asChild size="sm" variant="outline">
              <Link href="/research">{t('aiResearch')}</Link>
            </Button>
          </RoleGate>
        </div>
      </CardContent>
    </Card>
  );
}
