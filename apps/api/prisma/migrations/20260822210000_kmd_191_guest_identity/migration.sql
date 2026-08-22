CREATE TYPE "GuestAgeGateState" AS ENUM ('UNKNOWN', 'ADULT', 'MINOR_ALLOWED');
CREATE TYPE "GuestIdentityStatus" AS ENUM ('ACTIVE', 'REVOKED', 'CONVERTED', 'BLOCKED');

CREATE TABLE "GuestIdentity" (
    "id" TEXT NOT NULL,
    "publicAlias" TEXT,
    "tokenHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "ageGateState" "GuestAgeGateState" NOT NULL,
    "status" "GuestIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "convertedUserId" TEXT,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "GuestIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestIdentity_tokenHash_key" ON "GuestIdentity"("tokenHash");
CREATE INDEX "GuestIdentity_status_expiresAt_idx" ON "GuestIdentity"("status", "expiresAt");
CREATE INDEX "GuestIdentity_convertedUserId_idx" ON "GuestIdentity"("convertedUserId");
