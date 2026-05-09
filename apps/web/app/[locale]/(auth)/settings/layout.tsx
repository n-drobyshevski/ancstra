import { SettingsNav } from '@/components/settings/settings-nav';
import { PagePadding } from '@/components/page-padding';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PagePadding>
    <div className="md:flex md:min-h-[calc(100vh-4rem)] md:gap-6">
      <SettingsNav />
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
    </PagePadding>
  );
}
