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

CREATE TABLE "SecretMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderDeviceId" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'SIGNAL_LIBSIGNAL_V1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecretMessageEnvelope" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipientDeviceId" TEXT NOT NULL,
    "messageKind" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "SecretMessageEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecretMessage_senderDeviceId_clientMessageId_key"
ON "SecretMessage"("senderDeviceId", "clientMessageId");

CREATE INDEX "SecretMessage_conversationId_createdAt_id_idx"
ON "SecretMessage"("conversationId", "createdAt", "id");

CREATE INDEX "SecretMessage_senderUserId_createdAt_idx"
ON "SecretMessage"("senderUserId", "createdAt");

CREATE UNIQUE INDEX "SecretMessageEnvelope_messageId_recipientDeviceId_key"
ON "SecretMessageEnvelope"("messageId", "recipientDeviceId");

CREATE INDEX "SecretMessageEnvelope_recipientDeviceId_createdAt_id_idx"
ON "SecretMessageEnvelope"("recipientDeviceId", "createdAt", "id");

CREATE INDEX "SecretMessageEnvelope_recipientDeviceId_deliveredAt_createdAt_idx"
ON "SecretMessageEnvelope"("recipientDeviceId", "deliveredAt", "createdAt");

ALTER TABLE "SecretMessage"
ADD CONSTRAINT "SecretMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretMessage"
ADD CONSTRAINT "SecretMessage_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretMessage"
ADD CONSTRAINT "SecretMessage_senderDeviceId_fkey"
FOREIGN KEY ("senderDeviceId") REFERENCES "E2eeDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretMessageEnvelope"
ADD CONSTRAINT "SecretMessageEnvelope_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "SecretMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecretMessageEnvelope"
ADD CONSTRAINT "SecretMessageEnvelope_recipientDeviceId_fkey"
FOREIGN KEY ("recipientDeviceId") REFERENCES "E2eeDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
