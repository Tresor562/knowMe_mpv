CREATE TABLE "UserCallPreference" (
    "userId" TEXT NOT NULL,
    "incomingCallsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowAudioCalls" BOOLEAN NOT NULL DEFAULT true,
    "allowVideoCalls" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietStartMinute" INTEGER NOT NULL DEFAULT 1320,
    "quietEndMinute" INTEGER NOT NULL DEFAULT 420,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "microphoneEnabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "cameraEnabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "devicePreviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCallPreference_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "UserCallPreference_updatedAt_idx" ON "UserCallPreference"("updatedAt");
