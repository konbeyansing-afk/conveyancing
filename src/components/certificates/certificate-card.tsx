import { Award, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { CertificateStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS: Record<
  CertificateStatus,
  { label: string; description: string; icon: typeof Award; tone: "default" | "secondary" | "destructive" }
> = {
  PENDING_APPROVAL: {
    label: "Awaiting sign-off",
    description: "You've finished the program. A trainer is reviewing it before it's issued.",
    icon: Clock,
    tone: "secondary",
  },
  ISSUED: {
    label: "Issued",
    description: "Signed off and verifiable.",
    icon: CheckCircle2,
    tone: "default",
  },
  REVOKED: {
    label: "Revoked",
    description: "This certificate has been withdrawn.",
    icon: XCircle,
    tone: "destructive",
  },
};

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export function CertificateCard({
  certificate,
  showVerification = false,
}: {
  certificate: {
    certificateNumber: string;
    programTitle: string;
    traineeName: string;
    issuingOrganisation: string;
    status: CertificateStatus;
    completedAt: Date;
    issuedAt: Date | null;
    revokedReason: string | null;
    verificationCode: string;
  };
  showVerification?: boolean;
}) {
  const status = STATUS[certificate.status];
  const Icon = status.icon;

  return (
    <Card>
      <CardContent className="grid gap-4 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">{certificate.programTitle}</p>
              <p className="text-sm text-muted-foreground">{status.description}</p>
            </div>
          </div>
          <Badge variant={status.tone}>{status.label}</Badge>
        </div>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-muted-foreground">Certificate number</dt>
            <dd className="font-mono font-medium">{certificate.certificateNumber}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-muted-foreground">Awarded to</dt>
            <dd className="font-medium">{certificate.traineeName}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-muted-foreground">Training completed</dt>
            <dd className="font-medium">{formatDate(certificate.completedAt)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-muted-foreground">Issued</dt>
            <dd className="font-medium">{formatDate(certificate.issuedAt)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-muted-foreground">Issued by</dt>
            <dd className="font-medium">{certificate.issuingOrganisation}</dd>
          </div>
          {showVerification && certificate.status === "ISSUED" && (
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Verification code</dt>
              <dd className="font-mono text-xs break-all">{certificate.verificationCode}</dd>
            </div>
          )}
        </dl>

        {certificate.status === "REVOKED" && certificate.revokedReason && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <span className="font-medium">Reason:</span> {certificate.revokedReason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
