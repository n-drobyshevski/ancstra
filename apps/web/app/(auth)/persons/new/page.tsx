import { PersonForm } from '@/components/person-form';

export default function NewPersonPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-semibold mb-6">Add New Person</h1>
      <PersonForm />
    </div>
  );
}
