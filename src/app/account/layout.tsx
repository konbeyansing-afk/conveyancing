import type { ReactNode } from "react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/nav/dashboard-shell";
import type { NavKey } from "@/components/nav/nav-config";

const SHELL_FOR_ROLE: Record<string, { navKey: NavKey; roleLabel: string }> = {
  ADMIN: { navKey: "admin", roleLabel: "Admin" },
  TRAINER: { navKey: "trainer", roleLabel: "Trainer" },
  TRAINEE: { navKey: "trainee", roleLabel: "Trainee" },
  VA: { navKey: "va", roleLabel: "VA" },
};

/**
 * /account is shared by every role, so it borrows whichever sidebar the
 * signed-in user would otherwise be looking at rather than dropping them into a
 * chrome-less page.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const user = session!.user;
  const shell = SHELL_FOR_ROLE[user.role] ?? SHELL_FOR_ROLE.TRAINEE;

  return (
    <DashboardShell
      navKey={shell.navKey}
      roleLabel={shell.roleLabel}
      user={{ name: user.name ?? "", email: user.email ?? "" }}
    >
      {children}
    </DashboardShell>
  );
}
