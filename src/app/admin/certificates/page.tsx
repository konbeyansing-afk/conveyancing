import { Award } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { traineeScopeFilter } from "@/lib/trainer-scope";
import {
  IssueCertificateButton,
  RevokeCertificateButton,
} from "@/components/certificates/certificate-actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The sign-off queue. Admins see every certificate; a trainer sees only those
 * belonging to trainees assigned to them.
 */
export default async function AdminCertificatesPage() {
  const session = await auth();
  const actor = { id: session!.user.id, role: session!.user.role };

  const scope = await traineeScopeFilter(actor);
  const visibleTrainees = await prisma.user.findMany({ where: scope, select: { id: true } });
  const traineeIds = visibleTrainees.map((t) => t.id);

  const certificates = await prisma.certificate.findMany({
    where: { userId: { in: traineeIds } },
    orderBy: [{ status: "asc" }, { completedAt: "desc" }],
    include: { user: { select: { name: true, email: true } } },
  });

  const pending = certificates.filter((c) => c.status === "PENDING_APPROVAL");
  const issued = certificates.filter((c) => c.status === "ISSUED");
  const revoked = certificates.filter((c) => c.status === "REVOKED");

  const isAdmin = actor.role === "ADMIN";

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Certificates"
        description={
          isAdmin
            ? "Sign off certificates for trainees who have completed a whole program."
            : "Certificates for the trainees assigned to you."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Awaiting sign-off" value={pending.length} icon={Award} tone="warning" />
        <StatCard label="Issued" value={issued.length} icon={Award} tone="success" />
        <StatCard label="Revoked" value={revoked.length} icon={Award} />
      </div>

      {certificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          description={
            isAdmin
              ? "A certificate appears here once a trainee completes every published stage of a program."
              : "A certificate appears here once one of your trainees completes a whole program."
          }
        />
      ) : (
        <div className="grid gap-2">
          {certificates.map((certificate) => (
            <Card key={certificate.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {certificate.user.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {certificate.certificateNumber}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{certificate.programTitle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Completed {formatDate(certificate.completedAt)}
                    {certificate.issuedAt && ` · Issued ${formatDate(certificate.issuedAt)}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {certificate.status === "PENDING_APPROVAL" && (
                    <>
                      <Badge variant="secondary">Awaiting sign-off</Badge>
                      <IssueCertificateButton
                        certificateId={certificate.id}
                        traineeName={certificate.traineeName}
                        programTitle={certificate.programTitle}
                      />
                    </>
                  )}
                  {certificate.status === "ISSUED" && (
                    <>
                      <Badge>Issued</Badge>
                      {isAdmin && (
                        <RevokeCertificateButton
                          certificateId={certificate.id}
                          certificateNumber={certificate.certificateNumber}
                        />
                      )}
                    </>
                  )}
                  {certificate.status === "REVOKED" && <Badge variant="destructive">Revoked</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
