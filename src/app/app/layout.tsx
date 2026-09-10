import type { ReactNode } from "react";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/nav/dashboard-shell";
import type { Role } from "@prisma/client";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  TRAINER: "Trainer",
  TRAINEE: "Trainee",
  VA: "VA",
};

export default async function TraineeLayout({ children }: { children: ReactNode }) {
  // Middleware guarantees an authenticated session for every /app route.
  const session = await auth();
  const user = session!.user;

  // The /app area's tools (courses, simulators, the settlement calculator) are
  // open to any signed-in user, so an Admin or Trainer can be viewing this
  // section too — show their real role in the header and sidebar rather than
  // labelling everyone "Trainee". The nav itself stays the /app tool set.
  const roleLabel = ROLE_LABEL[user.role] ?? "Trainee";

  return (
    <DashboardShell
      navKey="trainee"
      roleLabel={roleLabel}
      user={{ name: user.name ?? roleLabel, email: user.email ?? "" }}
    >
      {children}
    </DashboardShell>
  );
}
