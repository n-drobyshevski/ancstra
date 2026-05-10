import { SettingsNav } from '@/components/settings/settings-nav';
import { SettingsMobileTabs } from '@/components/settings/settings-mobile-tabs';
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
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Mobile-only horizontal tab strip — md:hidden via the component.
            Self-suppresses on /settings (dashboard cards serve that role). */}
        <SettingsMobileTabs />
        {children}
      </div>
    </div>
    </PagePadding>
  );
}
