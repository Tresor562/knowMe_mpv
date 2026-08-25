ALTER TABLE "MediaAsset"
  ADD COLUMN "retentionPurgeAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "retentionPurgeLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "retentionPurgeNextAttemptAt" TIMESTAMP(3);

CREATE INDEX "MediaAsset_status_retentionPurgeNextAttemptAt_createdAt_idx"
  ON "MediaAsset"("status", "retentionPurgeNextAttemptAt", "createdAt");
