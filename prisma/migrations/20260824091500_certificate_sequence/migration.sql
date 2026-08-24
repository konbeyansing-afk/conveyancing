-- CreateTable
CREATE TABLE "CertificateSequence" (
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertificateSequence_pkey" PRIMARY KEY ("year")
);

