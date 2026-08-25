"use client";

import { useState } from "react";
import { Copy, FilePlus, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSettlement } from "@/lib/settlement/store";

/**
 * Every change already autosaves to localStorage as it happens (see
 * store.tsx / usePersistentReducer), so "Save" here is a reassurance
 * affordance rather than a distinct write — it's honest because the data
 * really is already persisted, but a professional still wants the click and
 * the confirmation. "Reset" and "Continue Editing" from the original spec
 * aren't separate controls: there's no seed data to revert to (a blank
 * calculator already is what Reset would produce), and reloading the page
 * already continues editing automatically via autosave.
 */
export function MatterActionsBar() {
  const { dispatch } = useSettlement();
  const [confirmingNew, setConfirmingNew] = useState(false);
  const [confirmingDuplicate, setConfirmingDuplicate] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          toast.success("Saved");
        }}
      >
        <Save className="size-3.5" />
        Save
      </Button>

      <AlertDialog open={confirmingNew} onOpenChange={setConfirmingNew}>
        <Button variant="outline" size="sm" onClick={() => setConfirmingNew(true)}>
          <FilePlus className="size-3.5" />
          New Calculation
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new calculation?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the matter details, every adjustment and cost you&apos;ve entered. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmingNew(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                dispatch({ type: "NEW_CALCULATION" });
                setConfirmingNew(false);
                toast.success("Started a new calculation");
              }}
            >
              Clear and start new
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingDuplicate} onOpenChange={setConfirmingDuplicate}>
        <Button variant="outline" size="sm" onClick={() => setConfirmingDuplicate(true)}>
          <Copy className="size-3.5" />
          Duplicate Matter
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate this matter?</AlertDialogTitle>
            <AlertDialogDescription>
              Keeps the transaction type, property address and price, and clears the settlement date, every
              adjustment, cost and override — for re-running the numbers on the same property.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmingDuplicate(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                dispatch({ type: "DUPLICATE_MATTER" });
                setConfirmingDuplicate(false);
                toast.success("Matter duplicated");
              }}
            >
              Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button variant="outline" size="sm" onClick={() => window.print()} className="ml-auto">
        <Printer className="size-3.5" />
        Export / Print
      </Button>
    </div>
  );
}
