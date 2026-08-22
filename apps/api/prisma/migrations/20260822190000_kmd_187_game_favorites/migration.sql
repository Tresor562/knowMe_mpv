CREATE TABLE "GameFavorite" (
  "userId" TEXT NOT NULL,
  "definitionKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GameFavorite_pkey" PRIMARY KEY ("userId", "definitionKey")
);

CREATE INDEX "GameFavorite_userId_createdAt_idx"
  ON "GameFavorite"("userId", "createdAt");

CREATE INDEX "GameFavorite_definitionKey_createdAt_idx"
  ON "GameFavorite"("definitionKey", "createdAt");
