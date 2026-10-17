-- Dynamic presentation only: never use these records for verification, staff or billing permissions.
CREATE TABLE "RuntimeExperienceConfig" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "document" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RuntimeExperienceConfig_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserCosmeticBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCosmeticBadge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserCosmeticBadge_userId_badgeKey_key" ON "UserCosmeticBadge"("userId","badgeKey");
CREATE INDEX "UserCosmeticBadge_badgeKey_expiresAt_idx" ON "UserCosmeticBadge"("badgeKey","expiresAt");
ALTER TABLE "UserCosmeticBadge" ADD CONSTRAINT "UserCosmeticBadge_userId_fkey"
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
