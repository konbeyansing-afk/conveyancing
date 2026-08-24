import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

/**
 * Shown in every workspace shell while an account is still using a password
 * that somebody else chose for it — a seeded admin, a newly created user, or
 * an admin reset. Disappears the moment they set their own.
 */
export async function MustChangePasswordBanner() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mustChangePassword: true },
  });
  if (!user?.mustChangePassword) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
      <ShieldAlert className="size-5 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">This account is using a password someone else set.</p>
        <p className="text-sm text-muted-foreground">
          Choose your own so nobody else can sign in as you.
        </p>
      </div>
      <Button size="sm" nativeButton={false} render={<Link href="/account" />}>
        Change password
      </Button>
    </div>
  );
}
