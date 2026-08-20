"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/nav/user-menu";
import { navByKey, type NavKey } from "@/components/nav/nav-config";
import { Circle, GraduationCap } from "lucide-react";

export function AppSidebar({
  navKey,
  user,
  roleLabel,
}: {
  navKey: NavKey;
  user: { name: string; email: string };
  roleLabel: string;
}) {
  const pathname = usePathname();
  const items = navByKey[navKey];
  // Pick the single most specific matching nav item (longest matching url) so a section
  // root like "/app" doesn't also light up on every nested route like "/app/courses".
  const activeUrl = items
    .map((item) => item.url)
    .filter((url) => pathname === url || pathname.startsWith(`${url}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  Conveyancing Academy
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {roleLabel}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-1 flex items-center gap-1.5 px-2 text-[11px] font-medium tracking-wide text-sidebar-primary uppercase group-data-[collapsible=icon]:hidden">
          <Circle className="size-2 shrink-0 fill-current" />
          {roleLabel} workspace
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = item.url === activeUrl;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.url} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu name={user.name} email={user.email} roleLabel={roleLabel} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
