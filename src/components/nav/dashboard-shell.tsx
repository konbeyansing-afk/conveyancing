import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { AppHeader } from "@/components/nav/app-header";
import type { NavKey } from "@/components/nav/nav-config";

export function DashboardShell({
  navKey,
  roleLabel,
  user,
  children,
}: {
  navKey: NavKey;
  roleLabel: string;
  user: { name: string; email: string };
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar navKey={navKey} user={user} roleLabel={roleLabel} />
      <SidebarInset>
        <AppHeader navKey={navKey} roleLabel={roleLabel} />
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
