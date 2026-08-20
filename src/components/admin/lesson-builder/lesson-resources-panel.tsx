import { ExternalLink, FileText, Plus, Trash2 } from "lucide-react";
import { addLessonAttachment, removeLessonAttachment } from "@/lib/actions/lessons";
import { FormDialog } from "@/components/admin/form-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FILE_TYPES = ["PDF", "Word", "Excel", "Image", "Video", "Other"];

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type LessonAttachmentSummary = {
  id: string;
  title: string;
  url: string;
  fileType: string;
  sizeBytes: number | null;
};

export function LessonResourcesPanel({
  programId,
  courseId,
  lessonId,
  attachments,
}: {
  programId: string;
  courseId: string;
  lessonId: string;
  attachments: LessonAttachmentSummary[];
}) {
  const addAction = addLessonAttachment.bind(null, programId, courseId, lessonId);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <CardTitle>Lesson resources</CardTitle>
          <CardDescription>
            Downloadable material trainees can access alongside this lesson.
          </CardDescription>
        </div>
        <FormDialog
          trigger={
            <>
              <Plus /> Add resource
            </>
          }
          triggerSize="sm"
          title="Add a resource"
          description="Link to a file that's already hosted somewhere accessible (Drive, SharePoint, etc.) — direct file uploads aren't set up yet."
          action={addAction}
          submitLabel="Add resource"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="resource-title">Title</Label>
            <Input
              id="resource-title"
              name="title"
              placeholder="e.g. Queensland Contract Checklist"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="resource-url">File URL</Label>
            <Input id="resource-url" name="url" type="url" placeholder="https://…" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="resource-fileType">File type</Label>
            <select
              id="resource-fileType"
              name="fileType"
              required
              defaultValue="PDF"
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              {FILE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </FormDialog>
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No resources yet"
            description="Attach PDFs, slide decks, or reference files trainees can open from this lesson."
          />
        ) : (
          <div className="grid gap-2">
            {attachments.map((attachment) => {
              const removeAction = removeLessonAttachment.bind(
                null,
                programId,
                courseId,
                lessonId,
                attachment.id
              );
              const size = formatSize(attachment.sizeBytes);
              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{attachment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {attachment.fileType}
                      {size ? ` · ${size}` : ""}
                    </p>
                  </div>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                  <DeleteConfirmDialog
                    trigger={<Trash2 className="size-4" />}
                    title={`Remove "${attachment.title}"?`}
                    description="Trainees will no longer see this resource on the lesson."
                    action={removeAction}
                    confirmLabel="Remove"
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
