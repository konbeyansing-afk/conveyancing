"use client";

import { Plus, Pencil } from "lucide-react";
import { FormDialog } from "@/components/admin/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createResource, updateResource } from "@/lib/actions/resources";

const FILE_TYPES = ["PDF", "Word", "Excel", "Image", "Video", "Other"];

function ProgramField({
  programs,
  defaultValue,
}: {
  programs: { id: string; title: string }[];
  defaultValue?: string | null;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="programId">Program (optional)</Label>
      <select
        id="programId"
        name="programId"
        defaultValue={defaultValue ?? ""}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
      >
        <option value="">General — visible to all trainees</option>
        {programs.map((program) => (
          <option key={program.id} value={program.id}>
            {program.title}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CreateResourceDialog({ programs }: { programs: { id: string; title: string }[] }) {
  return (
    <FormDialog
      trigger={
        <>
          <Plus /> Add Resource
        </>
      }
      title="Add a resource"
      description="Link to a file that's already hosted somewhere accessible — direct file uploads aren't set up yet."
      action={createResource}
      submitLabel="Add resource"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="url">File URL</Label>
        <Input id="url" name="url" type="url" placeholder="https://…" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="fileType">File type</Label>
        <select
          id="fileType"
          name="fileType"
          required
          defaultValue="PDF"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {FILE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <ProgramField programs={programs} />
    </FormDialog>
  );
}

export function EditResourceDialog({
  resourceId,
  title,
  description,
  url,
  fileType,
  programId,
  programs,
}: {
  resourceId: string;
  title: string;
  description: string | null;
  url: string;
  fileType: string;
  programId: string | null;
  programs: { id: string; title: string }[];
}) {
  const action = updateResource.bind(null, resourceId);

  return (
    <FormDialog
      trigger={<Pencil className="size-4" />}
      triggerVariant="ghost"
      triggerSize="icon-sm"
      title="Edit resource"
      action={action}
      submitLabel="Save changes"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" name="title" defaultValue={title} required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea id="edit-description" name="description" defaultValue={description ?? ""} rows={2} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-url">File URL</Label>
        <Input id="edit-url" name="url" type="url" defaultValue={url} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-fileType">File type</Label>
        <select
          id="edit-fileType"
          name="fileType"
          required
          defaultValue={fileType}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {FILE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <ProgramField programs={programs} defaultValue={programId} />
    </FormDialog>
  );
}
