CREATE TYPE "GuestGameSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED', 'EXPIRED');

CREATE TABLE "GuestGameSession" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "creationKey" TEXT NOT NULL,
    "status" "GuestGameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "seed" TEXT NOT NULL,
    "initialState" JSONB NOT NULL,
    "state" JSONB NOT NULL,
    "stateHash" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "currentTurnPosition" INTEGER,
    "result" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestGameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestGameAction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "stateHashBefore" TEXT NOT NULL,
    "stateHashAfter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestGameAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestGameActionReceipt" (
    "sessionId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestGameActionReceipt_pkey" PRIMARY KEY ("sessionId","guestId","idempotencyKey")
);

CREATE UNIQUE INDEX "GuestGameSession_guestId_creationKey_key" ON "GuestGameSession"("guestId", "creationKey");
CREATE INDEX "GuestGameSession_guestId_status_updatedAt_idx" ON "GuestGameSession"("guestId", "status", "updatedAt");
CREATE INDEX "GuestGameSession_status_expiresAt_idx" ON "GuestGameSession"("status", "expiresAt");
CREATE INDEX "GuestGameSession_definitionKey_definitionVersion_createdAt_idx" ON "GuestGameSession"("definitionKey", "definitionVersion", "createdAt");

CREATE UNIQUE INDEX "GuestGameAction_sessionId_sequence_key" ON "GuestGameAction"("sessionId", "sequence");
CREATE UNIQUE INDEX "GuestGameAction_sessionId_guestId_idempotencyKey_key" ON "GuestGameAction"("sessionId", "guestId", "idempotencyKey");
CREATE INDEX "GuestGameAction_guestId_createdAt_idx" ON "GuestGameAction"("guestId", "createdAt");
CREATE INDEX "GuestGameAction_sessionId_createdAt_idx" ON "GuestGameAction"("sessionId", "createdAt");

CREATE INDEX "GuestGameActionReceipt_guestId_createdAt_idx" ON "GuestGameActionReceipt"("guestId", "createdAt");
CREATE INDEX "GuestGameActionReceipt_createdAt_idx" ON "GuestGameActionReceipt"("createdAt");

ALTER TABLE "GuestGameSession" ADD CONSTRAINT "GuestGameSession_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestGameAction" ADD CONSTRAINT "GuestGameAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GuestGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestGameAction" ADD CONSTRAINT "GuestGameAction_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestGameActionReceipt" ADD CONSTRAINT "GuestGameActionReceipt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GuestGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestGameActionReceipt" ADD CONSTRAINT "GuestGameActionReceipt_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
