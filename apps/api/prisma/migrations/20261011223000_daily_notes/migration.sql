CREATE TABLE "DailyNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyNote_userId_key" ON "DailyNote"("userId");
CREATE INDEX "DailyNote_expiresAt_idx" ON "DailyNote"("expiresAt");
ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
