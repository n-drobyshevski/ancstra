import { Suspense } from 'react';
import { CreateFamilyWizard } from './wizard';
import { PublicLocaleSwitcher } from '@/components/auth/public-locale-switcher';

export default function CreateFamilyPage() {
  return (
    <>
      <PublicLocaleSwitcher />
      <Suspense fallback={null}>
        <CreateFamilyWizard />
      </Suspense>
    </>
  );
}
