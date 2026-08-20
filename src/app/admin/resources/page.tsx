import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteResource } from "@/lib/actions/resources";
import { CreateResourceDialog, EditResourceDialog } from "@/components/admin/resource-dialogs";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export default async function AdminResourcesPage() {
  const [resources, programs] = await Promise.all([
    prisma.resourceLibraryItem.findMany({
      orderBy: { createdAt: "desc" },
      include: { program: { select: { id: true, title: true } } },
    }),
    prisma.program.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Resources</h1>
          <p className="text-muted-foreground">
            Shared downloadable material trainees can access from the Resource Library.
          </p>
        </div>
        <CreateResourceDialog programs={programs} />
      </div>

      {resources.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resources yet"
          description="Add a PDF, template, or reference link for trainees to access."
        />
      ) : (
        <div className="grid gap-2">
          {resources.map((resource) => {
            const deleteAction = deleteResource.bind(null, resource.id);
            return (
              <Card key={resource.id}>
                <CardContent className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{resource.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {resource.fileType} · {resource.program ? resource.program.title : "General — all trainees"}
                    </p>
                  </div>
                  <Badge variant="outline">{resource.fileType}</Badge>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    title="Open"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                  <EditResourceDialog
                    resourceId={resource.id}
                    title={resource.title}
                    description={resource.description}
                    url={resource.url}
                    fileType={resource.fileType}
                    programId={resource.programId}
                    programs={programs}
                  />
                  <DeleteConfirmDialog
                    trigger={<Trash2 className="size-4" />}
                    title={`Delete "${resource.title}"?`}
                    description="Trainees will no longer be able to access this resource."
                    action={deleteAction}
                    confirmLabel="Delete"
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
