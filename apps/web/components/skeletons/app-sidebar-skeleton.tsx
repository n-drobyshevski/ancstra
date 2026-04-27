import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

// Counts mirror app-sidebar.tsx: 3 core, 4 research, 2 data, 2 analytics, 3 footer.
const CORE_ITEMS = 3;
const RESEARCH_ITEMS = 4;
const DATA_ITEMS = 2;
const ANALYTICS_ITEMS = 2;
const FOOTER_ITEMS = 3;

function NavItemSkeleton() {
  // Matches SidebarMenuButton (h-8) layout: icon + label
  return (
    <SidebarMenuItem>
      <div className="flex h-8 items-center gap-2 rounded-md px-2">
        <Skeleton className="size-4 shrink-0" />
        <Skeleton className="h-3 w-24" />
      </div>
    </SidebarMenuItem>
  );
}

function NavGroupSkeleton({ label, count }: { label?: string; count: number }) {
  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {Array.from({ length: count }).map((_, i) => (
          <NavItemSkeleton key={i} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function AppSidebarSkeleton() {
  return (
    <Sidebar collapsible="icon" role="navigation" aria-label="Main navigation">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex h-12 items-center gap-2 px-2">
              <Skeleton className="aspect-square size-8 rounded-lg" />
              <Skeleton className="h-4 w-20" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroupSkeleton count={CORE_ITEMS} />
        <NavGroupSkeleton label="Research" count={RESEARCH_ITEMS} />
        <NavGroupSkeleton label="Data" count={DATA_ITEMS} />
        <NavGroupSkeleton label="Analytics" count={ANALYTICS_ITEMS} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {Array.from({ length: FOOTER_ITEMS }).map((_, i) => (
            <NavItemSkeleton key={i} />
          ))}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
