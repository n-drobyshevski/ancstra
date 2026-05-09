import { Suspense } from 'react';
import { CreateFamilyWizard } from './wizard';

export default function CreateFamilyPage() {
  return (
    <Suspense fallback={null}>
      <CreateFamilyWizard />
    </Suspense>
  );
}
