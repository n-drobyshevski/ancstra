'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export function PersonForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      givenName: form.get('givenName') as string,
      surname: form.get('surname') as string,
      sex: form.get('sex') as string,
      birthDate: (form.get('birthDate') as string) || undefined,
      birthPlace: (form.get('birthPlace') as string) || undefined,
      deathDate: (form.get('deathDate') as string) || undefined,
      deathPlace: (form.get('deathPlace') as string) || undefined,
      isLiving: form.get('isLiving') === 'on',
      notes: (form.get('notes') as string) || undefined,
    };

    const res = await fetch('/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      if (data.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of data.issues) {
          const path = issue.path?.[0];
          if (path) fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
      } else {
        toast.error(data.error || 'Failed to create person');
      }
      setLoading(false);
      return;
    }

    const person = await res.json();
    toast.success(`${body.givenName} ${body.surname} created`);
    router.push(`/person/${person.id}`);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="givenName">Given Name *</Label>
              <Input id="givenName" name="givenName" required />
              {errors.givenName && (
                <p className="text-sm text-destructive">{errors.givenName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Surname *</Label>
              <Input id="surname" name="surname" required />
              {errors.surname && (
                <p className="text-sm text-destructive">{errors.surname}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex">Sex *</Label>
            <select
              id="sex"
              name="sex"
              defaultValue="U"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="U">Unknown</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthDate">Birth Date</Label>
              <Input
                id="birthDate"
                name="birthDate"
                placeholder="15 Mar 1845"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthPlace">Birth Place</Label>
              <Input
                id="birthPlace"
                name="birthPlace"
                placeholder="Springfield, IL"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deathDate">Death Date</Label>
              <Input
                id="deathDate"
                name="deathDate"
                placeholder="23 Nov 1923"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deathPlace">Death Place</Label>
              <Input id="deathPlace" name="deathPlace" />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="isLiving" name="isLiving" />
            <Label htmlFor="isLiving">Living Person</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Person'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
