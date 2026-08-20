import type { ReactNode } from "react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/nav/dashboard-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Middleware guarantees an authenticated ADMIN session for every /admin route.
  const session = await auth();
  const user = session!.user;

  return (
    <DashboardShell
      navKey="admin"
      roleLabel="Admin"
      user={{ name: user.name ?? "Admin", email: user.email ?? "" }}
    >
      {children}
    </DashboardShell>
  );
}
