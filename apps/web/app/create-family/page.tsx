'use client';

import { useActionState } from 'react';
import { createFamilyAction, type CreateFamilyState } from '@/app/actions/create-family';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function CreateFamilyPage() {
  const [state, action, pending] = useActionState<CreateFamilyState, FormData>(
    createFamilyAction,
    undefined,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">Create Your Family Tree</CardTitle>
          <p className="text-sm text-muted-foreground">
            Give your family tree a name to get started
          </p>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Family Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Smith Family Tree"
                required
              />
              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Creating...' : 'Create Family Tree'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
