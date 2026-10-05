ALTER TABLE "E2eeDevice"
DROP CONSTRAINT "E2eeDevice_sessionId_fkey";

ALTER TABLE "E2eeDevice"
ALTER COLUMN "sessionId" DROP NOT NULL;

ALTER TABLE "E2eeDevice"
ADD CONSTRAINT "E2eeDevice_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Conversation"
ADD COLUMN "encryptionMode" TEXT NOT NULL DEFAULT 'CLOUD';

CREATE INDEX "Conversation_encryptionMode_updatedAt_idx"
ON "Conversation"("encryptionMode", "updatedAt");

CREATE TABLE "E2eeMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderDeviceId" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'SIGNAL_LIBSIGNAL_V1',
    "payloadDigest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "E2eeMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "E2eeMessageEnvelope" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipientDeviceId" TEXT NOT NULL,
    "messageKind" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "E2eeMessageEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "E2eeMessage_senderDeviceId_clientMessageId_key"
ON "E2eeMessage"("senderDeviceId", "clientMessageId");

CREATE INDEX "E2eeMessage_conversationId_createdAt_id_idx"
ON "E2eeMessage"("conversationId", "createdAt", "id");

CREATE INDEX "E2eeMessage_senderUserId_createdAt_idx"
ON "E2eeMessage"("senderUserId", "createdAt");

CREATE UNIQUE INDEX "E2eeMessageEnvelope_messageId_recipientDeviceId_key"
ON "E2eeMessageEnvelope"("messageId", "recipientDeviceId");

CREATE INDEX "E2eeMessageEnvelope_recipientDeviceId_createdAt_id_idx"
ON "E2eeMessageEnvelope"("recipientDeviceId", "createdAt", "id");

CREATE INDEX "E2eeMessageEnvelope_recipientDeviceId_deliveredAt_createdAt_idx"
ON "E2eeMessageEnvelope"("recipientDeviceId", "deliveredAt", "createdAt");

ALTER TABLE "E2eeMessage"
ADD CONSTRAINT "E2eeMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "E2eeMessage"
ADD CONSTRAINT "E2eeMessage_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "E2eeMessage"
ADD CONSTRAINT "E2eeMessage_senderDeviceId_fkey"
FOREIGN KEY ("senderDeviceId") REFERENCES "E2eeDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "E2eeMessageEnvelope"
ADD CONSTRAINT "E2eeMessageEnvelope_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "E2eeMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "E2eeMessageEnvelope"
ADD CONSTRAINT "E2eeMessageEnvelope_recipientDeviceId_fkey"
FOREIGN KEY ("recipientDeviceId") REFERENCES "E2eeDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
