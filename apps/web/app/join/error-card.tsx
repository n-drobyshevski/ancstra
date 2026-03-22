import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ErrorCardProps {
  message?: string;
}

export function ErrorCard({ message }: ErrorCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Invalid Invitation</CardTitle>
          <p className="text-sm text-muted-foreground">
            {message || 'This invitation link is not valid.'}
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Go to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
