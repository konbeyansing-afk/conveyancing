import type { ReactNode } from "react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/nav/dashboard-shell";

export default async function TrainerLayout({ children }: { children: ReactNode }) {
  // Middleware guarantees an authenticated TRAINER (or ADMIN) session for every /trainer route.
  const session = await auth();
  const user = session!.user;

  return (
    <DashboardShell
      navKey="trainer"
      roleLabel="Trainer"
      user={{ name: user.name ?? "Trainer", email: user.email ?? "" }}
    >
      {children}
    </DashboardShell>
  );
}
