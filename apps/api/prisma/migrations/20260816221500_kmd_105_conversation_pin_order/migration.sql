ALTER TABLE "ConversationPin"
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "userId",
    "conversationId",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "pinnedAt" ASC, "conversationId" ASC
    ) - 1 AS "position"
  FROM "ConversationPin"
)
UPDATE "ConversationPin" AS pin
SET "position" = ranked."position"
FROM ranked
WHERE pin."userId" = ranked."userId"
  AND pin."conversationId" = ranked."conversationId";

CREATE INDEX "ConversationPin_userId_position_idx"
ON "ConversationPin"("userId", "position");
