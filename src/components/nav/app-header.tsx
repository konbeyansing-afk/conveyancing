"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { navByKey, type NavKey } from "@/components/nav/nav-config";

/** Shows the section the user is in, resolved from the same nav config as the sidebar. */
export function AppHeader({ navKey, roleLabel }: { navKey: NavKey; roleLabel: string }) {
  const pathname = usePathname();
  const current = navByKey[navKey]
    .filter((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))
    .sort((a, b) => b.url.length - a.url.length)[0];

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 px-4 backdrop-blur print:hidden">
      <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="text-muted-foreground">{roleLabel}</span>
        {current && (
          <>
            <span aria-hidden className="text-muted-foreground/50">
              /
            </span>
            <span className="truncate font-medium">{current.title}</span>
          </>
        )}
      </div>
    </header>
  );
}
