import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAuthContext } from '@/lib/auth/context';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HeaderProvider } from '@/lib/header-context';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  // Check if user has a family — if not, redirect to create one
  const authContext = await getAuthContext();
  if (!authContext) redirect('/create-family');

  return (
    <TooltipProvider>
      <HeaderProvider>
        <SidebarProvider defaultOpen={false}>
          <AppSidebar />
          <SidebarInset>
            <AppHeader />
            <div className="flex-1 p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </HeaderProvider>
    </TooltipProvider>
  );
}
