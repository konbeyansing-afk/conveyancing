"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, Save } from "lucide-react";
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
import { useMatterSettlementActions } from "./matter-settlement-store";

export function MatterSettlementActionsBar({ canFinalise }: { canFinalise: boolean }) {
  const { saveStatus, saveError, save, finalise, reset, isDirty } = useMatterSettlementActions();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingFinalise, setConfirmingFinalise] = useState(false);
  const [finalising, setFinalising] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button
        variant="outline"
        size="sm"
        disabled={saveStatus === "saving"}
        onClick={async () => {
          const result = await save();
          if (result.success) toast.success("Draft saved");
          else toast.error(result.error);
        }}
      >
        <Save className="size-3.5" />
        {saveStatus === "saving" ? "Saving…" : "Save Draft"}
        {isDirty && saveStatus !== "saving" && <span className="ml-1 size-1.5 rounded-full bg-warning" aria-label="Unsaved changes" />}
      </Button>

      <AlertDialog open={confirmingReset} onOpenChange={setConfirmingReset}>
        <Button variant="outline" size="sm" onClick={() => setConfirmingReset(true)}>
          <RotateCcw className="size-3.5" />
          Reset Calculator
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the calculator?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? Unsaved calculation data will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmingReset(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => reset()}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canFinalise && (
        <AlertDialog open={confirmingFinalise} onOpenChange={setConfirmingFinalise}>
          <Button size="sm" className="ml-auto" onClick={() => setConfirmingFinalise(true)}>
            <CheckCircle2 className="size-3.5" />
            Finalise Calculation
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalise this calculation?</AlertDialogTitle>
              <AlertDialogDescription>
                This locks the current figures as the record for this version and starts a new draft for any
                further changes. It can&apos;t be edited afterwards — an Admin or Trainer can reopen it if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmingFinalise(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={finalising}
                onClick={async () => {
                  setFinalising(true);
                  const result = await finalise();
                  setFinalising(false);
                  setConfirmingFinalise(false);
                  if (result.success) toast.success("Settlement Calculation Finalised");
                  else toast.error(result.error);
                }}
              >
                {finalising ? "Finalising…" : "Finalise"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {saveStatus === "error" && saveError && <p className="w-full text-xs text-destructive">{saveError}</p>}
    </div>
  );
}
