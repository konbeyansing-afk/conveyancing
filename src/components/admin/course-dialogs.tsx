"use client";

import { Plus, Pencil } from "lucide-react";
import { FormDialog } from "@/components/admin/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCourse, updateCourse } from "@/lib/actions/courses";

export function CreateCourseDialog({ programId, stageId }: { programId: string; stageId: string }) {
  const action = createCourse.bind(null, programId, stageId);

  return (
    <FormDialog
      trigger={
        <>
          <Plus /> Add Course
        </>
      }
      title="Add course"
      description='A course groups related modules, e.g. "Queensland Conveyancing Process."'
      action={action}
      submitLabel="Create course"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="course-title">Course title</Label>
        <Input id="course-title" name="title" required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="course-description">Description</Label>
        <Textarea id="course-description" name="description" rows={3} />
      </div>
    </FormDialog>
  );
}

export function EditCourseDialog({
  programId,
  courseId,
  title,
  description,
  order,
  isPublished,
}: {
  programId: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  isPublished: boolean;
}) {
  const action = updateCourse.bind(null, programId, courseId);

  return (
    <FormDialog
      trigger={
        <>
          <Pencil /> Edit
        </>
      }
      triggerVariant="outline"
      title="Edit course"
      action={action}
      submitLabel="Save changes"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="edit-course-title">Course title</Label>
        <Input id="edit-course-title" name="title" defaultValue={title} required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-course-description">Description</Label>
        <Textarea id="edit-course-description" name="description" defaultValue={description ?? ""} rows={3} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-course-order">Order</Label>
        <Input id="edit-course-order" name="order" type="number" defaultValue={order} className="w-24" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={isPublished} className="size-4 rounded border-border" />
        Published (visible to enrolled trainees)
      </label>
    </FormDialog>
  );
}
