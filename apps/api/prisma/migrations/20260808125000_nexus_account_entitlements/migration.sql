CREATE TABLE "NexusAccountLink" (
    "id" TEXT NOT NULL,
    "knowMeUserId" TEXT NOT NULL,
    "nexusUserId" TEXT NOT NULL,
    "lastPlan" TEXT NOT NULL DEFAULT 'free',
    "lastStatus" TEXT NOT NULL DEFAULT 'active',
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NexusAccountLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NexusAccountLink_knowMeUserId_key" ON "NexusAccountLink"("knowMeUserId");
CREATE UNIQUE INDEX "NexusAccountLink_nexusUserId_key" ON "NexusAccountLink"("nexusUserId");
CREATE INDEX "NexusAccountLink_lastPlan_verifiedAt_idx" ON "NexusAccountLink"("lastPlan", "verifiedAt");
