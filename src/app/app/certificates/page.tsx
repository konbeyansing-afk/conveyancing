import { Award } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CertificateCard } from "@/components/certificates/certificate-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default async function TraineeCertificatesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const certificates = await prisma.certificate.findMany({
    where: { userId },
    orderBy: { completedAt: "desc" },
  });

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <PageHeader
        title="Certificates"
        description="Awarded when you finish every stage of a program and a trainer signs it off."
      />

      {certificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          description="Finish every stage of a program and your certificate will appear here for a trainer to sign off."
        />
      ) : (
        <div className="grid gap-4">
          {certificates.map((certificate) => (
            <CertificateCard key={certificate.id} certificate={certificate} showVerification />
          ))}
        </div>
      )}
    </div>
  );
}
