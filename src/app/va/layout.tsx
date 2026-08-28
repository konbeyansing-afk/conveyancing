import type { ReactNode } from "react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/nav/dashboard-shell";

export default async function VaLayout({ children }: { children: ReactNode }) {
  // Middleware guarantees an authenticated VA session for every /va route.
  const session = await auth();
  const user = session!.user;

  return (
    <DashboardShell
      navKey="va"
      roleLabel="VA"
      user={{ name: user.name ?? "VA", email: user.email ?? "" }}
    >
      {children}
    </DashboardShell>
  );
}
