"use client";

import { useState, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ButtonVariants = VariantProps<typeof buttonVariants>;

export function FormDialog({
  trigger,
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName,
  title,
  description,
  action,
  onSuccess,
  submitLabel = "Save",
  children,
}: {
  trigger: ReactNode;
  triggerVariant?: ButtonVariants["variant"];
  triggerSize?: ButtonVariants["size"];
  triggerClassName?: string;
  title: string;
  description?: string;
  action: (formData: FormData) => Promise<unknown>;
  onSuccess?: (result: unknown) => void;
  submitLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(buttonVariants({ variant: triggerVariant, size: triggerSize }), triggerClassName)}
      >
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          action={async (formData) => {
            setPending(true);
            try {
              const result = await action(formData);
              setOpen(false);
              onSuccess?.(result);
            } catch (error) {
              const digest = (error as { digest?: string })?.digest;
              if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
                throw error;
              }
              toast.error("Something went wrong. Please try again.");
            } finally {
              setPending(false);
            }
          }}
          className="grid gap-4"
        >
          {children}
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: "outline" })}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
