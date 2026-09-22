-- Runtime evidence is append-only except for the one-shot consumption fence.
CREATE TABLE "HeroRuntimeEvidence" (
  "sessionId" TEXT NOT NULL,
  "schema" TEXT NOT NULL,
  "sourceEvidenceSha256" CHAR(64) NOT NULL,
  "sessionEvidenceSha256" CHAR(64) NOT NULL,
  "runtimeBundleSha256" CHAR(64) NOT NULL,
  "appVersion" TEXT NOT NULL,
  "commitSha" CHAR(40) NOT NULL,
  "acceptedAtMs" BIGINT NOT NULL,
  "consumedAtMs" BIGINT,
  "certificationId" TEXT,
  CONSTRAINT "HeroRuntimeEvidence_pkey" PRIMARY KEY ("sessionId"),
  CONSTRAINT "HeroRuntimeEvidence_sourceEvidenceSha256_key" UNIQUE ("sourceEvidenceSha256"),
  CONSTRAINT "HeroRuntimeEvidence_consumption_pair_check" CHECK (("consumedAtMs" IS NULL) = ("certificationId" IS NULL)),
  CONSTRAINT "HeroRuntimeEvidence_consumption_time_check" CHECK ("consumedAtMs" IS NULL OR "consumedAtMs" >= "acceptedAtMs")
);

CREATE INDEX "HeroRuntimeEvidence_runtimeBundleSha256_idx" ON "HeroRuntimeEvidence"("runtimeBundleSha256");
CREATE UNIQUE INDEX "HeroRuntimeEvidence_certificationId_key" ON "HeroRuntimeEvidence"("certificationId") WHERE "certificationId" IS NOT NULL;

-- PostgreSQL owns the replay fence: consumption succeeds only while both fields are NULL.
COMMENT ON TABLE "HeroRuntimeEvidence" IS 'KnowMe Hero Android runtime evidence v23; immutable provenance with atomic one-shot consumption';