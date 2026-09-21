"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/nav/user-menu";
import { navByKey, type NavKey } from "@/components/nav/nav-config";
import { GraduationCap } from "lucide-react";

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

  const groups = items.reduce<[string, typeof items][]>((acc, item) => {
    const existing = acc.find(([name]) => name === item.group);
    if (existing) existing[1].push(item);
    else acc.push([item.group, [item]]);
    return acc;
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/30">
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
      </SidebarHeader>
      <SidebarContent>
        {groups.map(([group, groupItems]) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className="text-[11px] font-medium tracking-wider text-sidebar-foreground/45 uppercase">
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {groupItems.map((item) => {
                  const isActive = item.url === activeUrl;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={item.url} aria-current={isActive ? "page" : undefined} />}
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
        ))}
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
