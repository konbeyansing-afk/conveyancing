import { ShieldCheck, ShieldX } from "lucide-react";
import { verifyCertificate } from "@/lib/certificates";

/**
 * Public certificate check. Deliberately outside every workspace shell and
 * outside the sign-in requirement — whoever is checking a certificate is a
 * prospective employer or client, not a user of this system.
 *
 * It only ever shows what is printed on the certificate itself.
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const result = await verifyCertificate(code);

  const formatDate = (date: Date | null) =>
    date ? date.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "—";

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-xl content-start gap-6 px-4 py-16">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Certificate verification
        </p>
        <h1 className="text-2xl font-semibold">Conveyancing Academy</h1>
      </div>

      {!result.found ? (
        <div className="grid gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldX className="size-5" />
            <p className="font-medium">No certificate matches this code</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Check the code and try again. Certificates that have not been signed off cannot be
            verified.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 rounded-xl border p-6">
          <div
            className={
              result.status === "ISSUED"
                ? "flex items-center gap-2 text-success"
                : "flex items-center gap-2 text-destructive"
            }
          >
            {result.status === "ISSUED" ? (
              <ShieldCheck className="size-5" />
            ) : (
              <ShieldX className="size-5" />
            )}
            <p className="font-medium">
              {result.status === "ISSUED"
                ? "This is a genuine certificate"
                : "This certificate has been revoked"}
            </p>
          </div>

          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Certificate number</dt>
              <dd className="font-mono font-medium">{result.certificateNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Awarded to</dt>
              <dd className="font-medium">{result.traineeName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Program</dt>
              <dd className="font-medium">{result.programTitle}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Training completed</dt>
              <dd className="font-medium">{formatDate(result.completedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Issued</dt>
              <dd className="font-medium">{formatDate(result.issuedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Issued by</dt>
              <dd className="font-medium">{result.issuingOrganisation}</dd>
            </div>
            {result.revokedAt && (
              <div>
                <dt className="text-muted-foreground">Revoked</dt>
                <dd className="font-medium">{formatDate(result.revokedAt)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </main>
  );
}
