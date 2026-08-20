"use client";

import { Rocket, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export function PublishLessonDialog({
  ready,
  missing,
  publishAction,
}: {
  ready: boolean;
  missing: string[];
  publishAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger className={buttonVariants({ variant: "default" })}>
        <Rocket /> Publish Lesson
      </AlertDialogTrigger>
      <AlertDialogContent>
        {ready ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Publish this lesson?</AlertDialogTitle>
              <AlertDialogDescription>
                Once published, trainees with access to this course will be able to view this
                lesson.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={publishAction}>
                <AlertDialogAction type="submit" className="w-full">
                  Publish Lesson
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>This lesson cannot be published yet</AlertDialogTitle>
              <AlertDialogDescription>Please complete:</AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="grid gap-1.5 py-2">
              {missing.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-destructive">
                  <X className="size-3.5" /> {item}
                </li>
              ))}
            </ul>
            <AlertDialogFooter>
              <AlertDialogCancel className="w-full">Got it</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

