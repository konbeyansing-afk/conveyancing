"use client";

import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
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

type ButtonVariants = VariantProps<typeof buttonVariants>;

export function DeleteConfirmDialog({
  trigger,
  triggerVariant = "ghost",
  triggerSize = "icon-sm",
  triggerClassName,
  title,
  description,
  action,
  confirmLabel = "Delete",
}: {
  trigger: ReactNode;
  triggerVariant?: ButtonVariants["variant"];
  triggerSize?: ButtonVariants["size"];
  triggerClassName?: string;
  title: string;
  description: string;
  action: (formData: FormData) => Promise<void>;
  confirmLabel?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        className={cn(buttonVariants({ variant: triggerVariant, size: triggerSize }), triggerClassName)}
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={action}>
            <AlertDialogAction type="submit" variant="destructive" className="w-full">
              {confirmLabel}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
