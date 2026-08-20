import { Eye } from "lucide-react";

export function DraftPreviewBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary">
      <Eye className="size-4 shrink-0" />
      You&apos;re previewing this as staff — it&apos;s not published, so trainees can&apos;t see it yet.
    </div>
  );
}
