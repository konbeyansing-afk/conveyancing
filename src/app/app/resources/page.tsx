import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ResourceLibrary } from "@/components/trainee/resource-library";

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
    include: { program: { select: { title: true, jurisdiction: true } } },
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Learning Library"
        description="Guides, templates and reference material for your programs — search or filter to find what you need."
      />
      <ResourceLibrary
        resources={resources.map((r) => ({
          id: r.id,
          title: r.title,
          url: r.url,
          fileType: r.fileType,
          description: r.description,
          programTitle: r.program?.title ?? null,
          jurisdiction: r.program?.jurisdiction ?? null,
        }))}
      />
    </div>
  );
}
