import type { ReactNode } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/nav/app-sidebar";
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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">
            {roleLabel} workspace
          </span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
