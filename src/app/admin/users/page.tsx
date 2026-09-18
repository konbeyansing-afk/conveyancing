import { Users as UsersIcon } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateUserRole, deleteUser } from "@/lib/actions/users";
import { EmptyState } from "@/components/empty-state";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminUsersPage() {
  const session = await auth();
  const currentUserId = session!.user.id;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-muted-foreground">
          Invite trainees, trainers and VAs, and manage roles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New user</CardTitle>
          <CardDescription>
            They&apos;ll sign in with this email and password — share it with them directly. Only an
            admin can change a user&apos;s password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      {users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users yet" description="Create one above." />
      ) : (
        <div className="grid gap-2">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const updateRoleWithId = updateUserRole.bind(null, user.id);
            const deleteUserWithId = deleteUser.bind(null, user.id);

            return (
              <Card key={user.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">
                      {user.name}{" "}
                      {isSelf && (
                        <Badge variant="outline" className="ml-1">
                          You
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  {isSelf ? (
                    <div className="flex items-center gap-2">
                      <Badge>{user.role}</Badge>
                      <ResetPasswordDialog
                        userId={user.id}
                        userName={user.name}
                        userEmail={user.email}
                      />
                    </div>
                  ) : (
                    <form action={updateRoleWithId} className="flex items-center gap-2">
                      <select
                        key={user.role}
                        name="role"
                        defaultValue={user.role}
                        className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                      >
                        <option value="TRAINEE">Trainee</option>
                        <option value="TRAINER">Trainer</option>
                        <option value="VA">VA</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <Button type="submit" variant="outline" size="sm">
                        Save
                      </Button>
                      <ResetPasswordDialog
                        userId={user.id}
                        userName={user.name}
                        userEmail={user.email}
                      />
                      <DeleteConfirmDialog
                        trigger="Delete"
                        triggerVariant="ghost"
                        triggerSize="sm"
                        title={`Delete "${user.name}"?`}
                        description={`This removes their account (${user.email}). This cannot be undone.`}
                        action={deleteUserWithId}
                      />
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
