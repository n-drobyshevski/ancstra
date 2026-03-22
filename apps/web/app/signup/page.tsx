'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signUp, type SignUpState } from '@/app/actions/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { OAuthButtons } from '@/components/auth/oauth-buttons';

export default function SignUpPage() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(
    signUp,
    undefined
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">Ancstra</CardTitle>
          <p className="text-sm text-muted-foreground">Create your account</p>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Your name" required />
              {state?.errors?.name && (
                <p className="text-sm text-destructive">{state.errors.name[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
              {state?.errors?.email && (
                <p className="text-sm text-destructive">{state.errors.email[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
              />
              {state?.errors?.password && (
                <p className="text-sm text-destructive">
                  {state.errors.password[0]}
                </p>
              )}
            </div>
            {state?.message && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Creating account...' : 'Create Account'}
            </Button>
            <OAuthButtons />
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
