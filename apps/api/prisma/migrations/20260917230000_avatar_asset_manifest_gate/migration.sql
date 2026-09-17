-- Persist the validated runtime 3D contract on the authoritative cosmetic definition.
-- Existing cosmetics remain valid as legacy/non-avatar definitions; avatar activation is gated in the service.
ALTER TABLE "CosmeticItemDefinition"
ADD COLUMN "avatarAssetManifest" JSONB,
ADD COLUMN "assetValidatedAt" TIMESTAMP(3);

CREATE INDEX "CosmeticItemDefinition_assetValidatedAt_active_idx"
ON "CosmeticItemDefinition"("assetValidatedAt", "active");
