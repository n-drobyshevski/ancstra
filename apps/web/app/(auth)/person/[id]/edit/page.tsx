import { notFound } from 'next/navigation';
import { createDb } from '@ancstra/db';
import { assemblePersonDetail } from '@/lib/queries';
import { PersonForm } from '@/components/person-form';
import { EventList } from '@/components/event-list';

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createDb();
  const person = assemblePersonDetail(db, id);
  if (!person) notFound();

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-8">
      <h1 className="text-xl font-semibold">
        Edit {person.givenName} {person.surname}
      </h1>
      <PersonForm person={person} />
      <div>
        <h2 className="text-lg font-medium mb-4">Events</h2>
        <EventList events={person.events} personId={person.id} />
      </div>
      <div className="text-sm text-muted-foreground">
        <p>
          Manage relationships on the{' '}
          <a href={`/person/${person.id}`} className="text-primary underline">
            detail page
          </a>
          .
        </p>
      </div>
    </div>
  );
}
