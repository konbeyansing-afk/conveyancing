"use client";

import { useActionState, useState } from "react";
import { createUser } from "@/lib/actions/users";
import { TEMPORARY_PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateUserForm() {
  // Controlled so a validation error coming back from the server action never
  // wipes what the admin already typed — they only need to fix the one field.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("TRAINEE");

  const [state, formAction, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof createUser>>, formData: FormData) => {
      const result = await createUser(prev, formData);
      // Only wipe the fields once the user has actually been created.
      if (result === null) {
        setName("");
        setEmail("");
        setPassword("");
        setRole("TRAINEE");
      }
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Temporary password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={TEMPORARY_PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          At least {TEMPORARY_PASSWORD_MIN_LENGTH} characters. They&apos;ll be asked to set a proper
          one on first login.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
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
