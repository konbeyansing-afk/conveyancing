import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  TRAINER: "Trainer",
  TRAINEE: "Trainee",
};

export default async function AccountPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      passwordChangedAt: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <PageHeader
        title="Your account"
        description="Your sign-in details."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="secondary">{ROLE_LABEL[user.role] ?? user.role}</Badge>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Password last changed</span>
            <span className="font-medium">
              {user.passwordChangedAt
                ? user.passwordChangedAt.toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Never"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Only an admin can change your password. Contact one if you need it reset.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
