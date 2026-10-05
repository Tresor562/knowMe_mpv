-- KnowMe E2EE public key directory.
-- Only public key material is stored here. Private identity/session keys must remain client-side.

CREATE TABLE "E2eeDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'SIGNAL_LIBSIGNAL_V1',
    "registrationId" INTEGER NOT NULL,
    "identityKey" TEXT NOT NULL,
    "signedPreKeyId" INTEGER NOT NULL,
    "signedPreKey" TEXT NOT NULL,
    "signedPreKeySignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "E2eeDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "E2eeOneTimePreKey" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "keyId" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "E2eeOneTimePreKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "E2eeDevice_sessionId_key" ON "E2eeDevice"("sessionId");
CREATE INDEX "E2eeDevice_userId_revokedAt_idx" ON "E2eeDevice"("userId", "revokedAt");
CREATE INDEX "E2eeDevice_protocol_revokedAt_idx" ON "E2eeDevice"("protocol", "revokedAt");

CREATE UNIQUE INDEX "E2eeOneTimePreKey_deviceId_keyId_key"
ON "E2eeOneTimePreKey"("deviceId", "keyId");
CREATE INDEX "E2eeOneTimePreKey_deviceId_claimedAt_keyId_idx"
ON "E2eeOneTimePreKey"("deviceId", "claimedAt", "keyId");

ALTER TABLE "E2eeDevice"
ADD CONSTRAINT "E2eeDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "E2eeDevice"
ADD CONSTRAINT "E2eeDevice_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "E2eeOneTimePreKey"
ADD CONSTRAINT "E2eeOneTimePreKey_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "E2eeDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
