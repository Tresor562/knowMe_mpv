-- Persist Avatar Universe acquisition policy in the authoritative Cosmetics catalog.
ALTER TABLE "CosmeticItemDefinition"
ADD COLUMN "acquisitionMode" TEXT NOT NULL DEFAULT 'FREE';

CREATE INDEX "CosmeticItemDefinition_acquisitionMode_active_idx"
ON "CosmeticItemDefinition"("acquisitionMode", "active");
