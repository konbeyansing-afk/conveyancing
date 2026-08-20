import type { JSONContent } from "@tiptap/core";
import { NotebookPen } from "lucide-react";
import { LessonEditor } from "@/components/lesson-content/lesson-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function LessonContentStep({
  content,
  trainerNotes,
  saveContent,
  saveTrainerNotes,
}: {
  content: JSONContent | null;
  trainerNotes: JSONContent | null;
  saveContent: (content: JSONContent) => Promise<void>;
  saveTrainerNotes: (content: JSONContent) => Promise<void>;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Lesson content</CardTitle>
          <CardDescription>
            What trainees read and interact with. Build it visually — no HTML or Markdown
            required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LessonEditor
            initialContent={content}
            onSave={saveContent}
            emptyHint="No content yet — use the toolbar above to start writing."
          />
        </CardContent>
      </Card>

      <Collapsible>
        <Card className="gap-0 overflow-hidden py-0">
          <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-left">
            <NotebookPen className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Trainer notes (internal)</p>
              <p className="text-xs text-muted-foreground">
                Facilitation tips and answer keys — never shown to trainees.
              </p>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-4">
              <LessonEditor
                initialContent={trainerNotes}
                onSave={saveTrainerNotes}
                emptyHint="No trainer notes yet."
              />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
