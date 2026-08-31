import type { ReactNode } from "react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/nav/dashboard-shell";

/**
 * Middleware guarantees an authenticated VA session for every /va route —
 * except /va/settlement-calculator/[workItemId] (and its history pages),
 * which Admin/Trainer can also reach to review or reopen a VA's
 * calculation (see proxy.ts). Landing there, they should see their own
 * sidebar, not VA branding and a Work Status link proxy.ts would
 * immediately bounce them from.
 */
export default async function VaLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.role === "ADMIN";
  const isTrainer = user.role === "TRAINER";

  return (
    <DashboardShell
      navKey={isAdmin ? "admin" : isTrainer ? "trainer" : "va"}
      roleLabel={isAdmin ? "Admin" : isTrainer ? "Trainer" : "VA"}
      user={{ name: user.name ?? "VA", email: user.email ?? "" }}
    >
      {children}
    </DashboardShell>
  );
}
