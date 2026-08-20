"use client";

import { Plus, Pencil } from "lucide-react";
import { FormDialog } from "@/components/admin/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProgram, updateProgram } from "@/lib/actions/programs";

export function CreateProgramDialog({
  triggerVariant,
  triggerClassName,
}: {
  triggerVariant?: "default" | "outline";
  triggerClassName?: string;
} = {}) {
  return (
    <FormDialog
      trigger={
        <>
          <Plus /> Create Program
        </>
      }
      triggerVariant={triggerVariant}
      triggerClassName={triggerClassName}
      title="Create program"
      description='A program is the top-level container for related courses, e.g. "QLD Conveyancing."'
      action={createProgram}
      submitLabel="Create program"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="title">Program name</Label>
        <Input id="title" name="title" required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="coverImageUrl">Cover image URL (optional)</Label>
        <Input
          id="coverImageUrl"
          name="coverImageUrl"
          type="url"
          placeholder="https://…"
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to use an automatically generated cover instead.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue="draft"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>
    </FormDialog>
  );
}

export function EditProgramDialog({
  programId,
  title,
  description,
  coverImageUrl,
  isPublished,
}: {
  programId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
}) {
  const action = updateProgram.bind(null, programId);

  return (
    <FormDialog
      trigger={
        <>
          <Pencil /> Edit
        </>
      }
      triggerVariant="outline"
      title="Edit program"
      action={action}
      submitLabel="Save changes"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="edit-title">Program name</Label>
        <Input id="edit-title" name="title" defaultValue={title} required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea id="edit-description" name="description" defaultValue={description ?? ""} rows={3} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-coverImageUrl">Cover image URL (optional)</Label>
        <Input
          id="edit-coverImageUrl"
          name="coverImageUrl"
          type="url"
          defaultValue={coverImageUrl ?? ""}
          placeholder="https://…"
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to use an automatically generated cover instead.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={isPublished} className="size-4 rounded border-border" />
        Published (visible to enrolled trainees)
      </label>
    </FormDialog>
  );
}
