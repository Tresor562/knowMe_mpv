CREATE TABLE "AvatarIdentityProfile" (
    "userId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "morphology" JSONB NOT NULL,
    "personality" JSONB NOT NULL,
    "renderTier" TEXT NOT NULL DEFAULT 'REALTIME_3D_BALANCED',
    "baseMeshKey" TEXT NOT NULL DEFAULT 'knowme-human-v1',
    "skeletonKey" TEXT NOT NULL DEFAULT 'knowme-humanoid-v1',
    "facialRigKey" TEXT NOT NULL DEFAULT 'knowme-face-v1',
    "materialProfileKey" TEXT NOT NULL DEFAULT 'knowme-pbr-skin-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvatarIdentityProfile_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "AvatarIdentityProfile_updatedAt_idx" ON "AvatarIdentityProfile"("updatedAt");
CREATE INDEX "AvatarIdentityProfile_schemaVersion_renderTier_idx" ON "AvatarIdentityProfile"("schemaVersion", "renderTier");
