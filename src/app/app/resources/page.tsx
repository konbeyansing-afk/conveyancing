import { ExternalLink, FileText, Library } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function TraineeResourcesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const enrolledProgramIds = await prisma.enrollment
    .findMany({
      where: { userId },
      select: { course: { select: { programId: true } } },
    })
    .then((rows) => [...new Set(rows.map((r) => r.course.programId))]);

  const resources = await prisma.resourceLibraryItem.findMany({
    where: { OR: [{ programId: null }, { programId: { in: enrolledProgramIds } }] },
    orderBy: { createdAt: "desc" },
    include: { program: { select: { title: true } } },
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Resource library</h1>
        <p className="text-muted-foreground">
          Shared downloadable material across your programs.
        </p>
      </div>
      {resources.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No resources yet"
          description="Downloadable guides, templates, and reference material will appear here."
        />
      ) : (
        <div className="grid gap-2">
          {resources.map((resource) => (
            <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer">
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{resource.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {resource.program ? resource.program.title : "General"}
                      {resource.description ? ` · ${resource.description}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{resource.fileType}</Badge>
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
