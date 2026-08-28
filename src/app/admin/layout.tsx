import type { ReactNode } from "react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/nav/dashboard-shell";

/**
 * Middleware guarantees an authenticated ADMIN session for every /admin
 * route — except /admin/work-status, which a Trainer can also reach (see
 * proxy.ts). A Trainer landing there should see their own sidebar, not the
 * full Admin one full of links proxy.ts would immediately bounce them from.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const user = session!.user;
  const isTrainer = user.role === "TRAINER";

  return (
    <DashboardShell
      navKey={isTrainer ? "trainer" : "admin"}
      roleLabel={isTrainer ? "Trainer" : "Admin"}
      user={{ name: user.name ?? "Admin", email: user.email ?? "" }}
    >
      {children}
    </DashboardShell>
  );
}
