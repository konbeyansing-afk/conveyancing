import type { ReactNode } from "react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/nav/dashboard-shell";

export default async function TraineeLayout({ children }: { children: ReactNode }) {
  // Middleware guarantees an authenticated session for every /app route.
  const session = await auth();
  const user = session!.user;

  return (
    <DashboardShell
      navKey="trainee"
      roleLabel="Trainee"
      user={{ name: user.name ?? "Trainee", email: user.email ?? "" }}
    >
      {children}
    </DashboardShell>
  );
}
