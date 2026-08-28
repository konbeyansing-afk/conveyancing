"use client";

import { useActionState } from "react";
import { createUser } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, null);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Temporary password</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="TRAINEE"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="TRAINEE">Trainee</option>
          <option value="TRAINER">Trainer</option>
          <option value="VA">VA</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="sm:col-span-2 sm:w-fit">
        {pending ? "Creating…" : "Create user"}
      </Button>
    </form>
  );
}
