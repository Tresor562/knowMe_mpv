CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "resolveCount" INTEGER NOT NULL DEFAULT 0,
    "lastResolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShortLinkReceipt" (
    "ownerId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortLinkReceipt_pkey" PRIMARY KEY ("ownerId", "idempotencyKey")
);

CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");
CREATE INDEX "ShortLink_ownerId_createdAt_idx" ON "ShortLink"("ownerId", "createdAt");
CREATE INDEX "ShortLink_targetType_targetId_idx" ON "ShortLink"("targetType", "targetId");
CREATE INDEX "ShortLink_expiresAt_revokedAt_idx" ON "ShortLink"("expiresAt", "revokedAt");
CREATE INDEX "ShortLinkReceipt_createdAt_idx" ON "ShortLinkReceipt"("createdAt");

INSERT INTO "FeatureFlag" (
    "id", "key", "description", "enabled", "exposeToClient", "riskLevel", "owner", "createdAt", "updatedAt"
)
VALUES (
    'kmd060-short-links',
    'short_links.creation',
    'Autorise la création progressive de liens courts KnowMe.',
    false,
    false,
    'HIGH',
    'KnowMe Core',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
