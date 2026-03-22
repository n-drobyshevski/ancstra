'use client';

import { useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { acceptInviteAction } from '@/app/actions/join';

interface JoinCardProps {
  familyName: string;
  role: string;
  token: string;
  userId: string;
}

export function JoinCard({ familyName, role, token, userId }: JoinCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      await acceptInviteAction(token, userId);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Join Family Tree</CardTitle>
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join <strong>{familyName}</strong> as{' '}
            <strong>{role}</strong>
          </p>
        </CardHeader>
        <CardContent>
          <form action={handleAccept}>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Joining...' : 'Accept Invitation'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
