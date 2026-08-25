ALTER TABLE "MediaAsset"
  ADD COLUMN "scannerAttemptCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "scannerLastAttemptAt" TIMESTAMP(3);

CREATE INDEX "MediaAsset_status_scannerVerdict_scannerLastAttemptAt_idx"
  ON "MediaAsset"("status", "scannerVerdict", "scannerLastAttemptAt");
