import { CircleCheck, CircleDashed } from "lucide-react";
import { LessonSetupChecklist } from "./lesson-setup-checklist";
import { PublishLessonDialog } from "./publish-lesson-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LessonPublishStep({
  isPublished,
  hasTitle,
  hasDescription,
  hasContent,
  hasDuration,
  unpublishAction,
  publishAction,
}: {
  isPublished: boolean;
  hasTitle: boolean;
  hasDescription: boolean;
  hasContent: boolean;
  hasDuration: boolean;
  unpublishAction: (formData: FormData) => Promise<void>;
  publishAction: (formData: FormData) => Promise<void>;
}) {
  const missing: string[] = [];
  if (!hasTitle) missing.push("Lesson title");
  if (!hasContent) missing.push("Lesson content");
  const readiness = { ok: missing.length === 0, missing };

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_280px]">
      <Card>
        <CardHeader>
          <CardTitle>Ready to publish?</CardTitle>
          <CardDescription>
            Once published, trainees with access to this course will be able to view this
            lesson.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {isPublished ? (
            <>
              <Badge className="bg-primary/10 text-primary">
                <CircleCheck /> Published
              </Badge>
              <form action={unpublishAction}>
                <Button type="submit" variant="outline">
                  Unpublish
                </Button>
              </form>
            </>
          ) : (
            <>
              <Badge variant="outline" className="text-muted-foreground">
                <CircleDashed /> Draft
              </Badge>
              <PublishLessonDialog ready={readiness.ok} missing={readiness.missing} publishAction={publishAction} />
            </>
          )}
        </CardContent>
      </Card>

      <LessonSetupChecklist
        items={[
          { label: "Title", done: hasTitle, required: true },
          { label: "Description", done: hasDescription },
          { label: "Estimated duration", done: hasDuration },
          { label: "Lesson content", done: hasContent, required: true },
        ]}
      />
    </div>
  );
}
