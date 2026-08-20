"use client";

import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { FormDialog } from "@/components/admin/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createModule, updateModule } from "@/lib/actions/modules";
import { createLesson } from "@/lib/actions/lessons";

export function CreateModuleDialog({
  programId,
  courseId,
}: {
  programId: string;
  courseId: string;
}) {
  const action = createModule.bind(null, programId, courseId);

  return (
    <FormDialog
      trigger={
        <>
          <Plus /> Add Module
        </>
      }
      title="Add module"
      description='A module groups related lessons, e.g. "Opening a Matter."'
      action={action}
      submitLabel="Add module"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="module-title">Module title</Label>
        <Input id="module-title" name="title" required autoFocus />
      </div>
    </FormDialog>
  );
}

export function EditModuleDialog({
  programId,
  courseId,
  moduleId,
  title,
  order,
}: {
  programId: string;
  courseId: string;
  moduleId: string;
  title: string;
  order: number;
}) {
  const action = updateModule.bind(null, programId, courseId, moduleId);

  return (
    <FormDialog
      trigger={<Pencil className="size-4" />}
      triggerVariant="ghost"
      triggerSize="icon-sm"
      title="Edit module"
      action={action}
      submitLabel="Save changes"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="edit-module-title">Module title</Label>
        <Input id="edit-module-title" name="title" defaultValue={title} required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-module-order">Order</Label>
        <Input id="edit-module-order" name="order" type="number" defaultValue={order} className="w-24" />
      </div>
    </FormDialog>
  );
}

export function CreateLessonDialog({
  programId,
  courseId,
  moduleId,
}: {
  programId: string;
  courseId: string;
  moduleId: string;
}) {
  const router = useRouter();
  const action = createLesson.bind(null, programId, courseId, moduleId);

  return (
    <FormDialog
      trigger={
        <>
          <Plus /> Add lesson
        </>
      }
      triggerVariant="secondary"
      triggerSize="sm"
      title="Add lesson"
      action={action}
      onSuccess={(result) => {
        const { lessonId } = (result as { lessonId?: string } | undefined) ?? {};
        if (lessonId) {
          router.push(`/admin/programs/${programId}/courses/${courseId}/lessons/${lessonId}`);
        }
      }}
      submitLabel="Add lesson"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="lesson-title">Lesson title</Label>
        <Input id="lesson-title" name="title" placeholder="e.g. Introduction to Contract Review" required autoFocus />
      </div>
    </FormDialog>
  );
}
