-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CallMedia" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'ENDED', 'REJECTED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallEndReason" AS ENUM ('HANGUP', 'REJECTED', 'MISSED', 'CANCELLED', 'ACCOUNT_DELETED', 'MODERATION');

-- CreateEnum
CREATE TYPE "CreatorProfileStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CreatorProfileVisibility" AS ENUM ('PUBLIC', 'UNLISTED');

-- CreateEnum
CREATE TYPE "CreatorMetricKind" AS ENUM ('PROFILE_VIEW', 'POST_VIEW');

-- CreateEnum
CREATE TYPE "GameCatalogStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED', 'ABANDONED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GameParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'LEFT', 'ABANDONED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SecretCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SecretMessageStatus" AS ENUM ('DELIVERED', 'PENDING_REVIEW', 'BLOCKED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "NotificationCenterDigestMode" AS ENUM ('INSTANT', 'HOURLY', 'DAILY', 'CENTER_ONLY');

-- CreateEnum
CREATE TYPE "NotificationCenterDigestQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProfileCircleTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProfileCircleMomentType" AS ENUM ('TEXT', 'PHOTO', 'DRAWING', 'GIF', 'GIFT', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "ProfileCircleContentStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "ProfileCircleContentAudience" AS ENUM ('PUBLIC', 'MEMBERS');

-- CreateEnum
CREATE TYPE "ProfileCircleStoryType" AS ENUM ('TEXT', 'PHOTO', 'VIDEO', 'GIFT', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "ProfileFamilyRelationType" AS ENUM ('PARENT', 'CHILD', 'SIBLING', 'COUSIN', 'SPOUSE', 'GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "ProfileFamilyRelationStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationDigestMode" AS ENUM ('OFF', 'DAILY');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationProviderCircuitStatus" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationDeadLetterStatus" AS ENUM ('OPEN', 'REPLAYING', 'RESOLVED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationWebhookReceiptStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationSuppressionReason" AS ENUM ('USER_OPT_OUT', 'HARD_BOUNCE', 'COMPLAINT', 'INVALID_ENDPOINT', 'ADMINISTRATIVE');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationTransportChannel" AS ENUM ('PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED', 'INVALID');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationTransportAttemptStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationGroupingMode" AS ENUM ('BY_CIRCLE', 'BY_TYPE', 'CHRONOLOGICAL');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationRecipientStatus" AS ENUM ('PENDING', 'DEFERRED', 'PROCESSING', 'DELIVERED', 'SUPPRESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProfileCircleNotificationDeliveryMode" AS ENUM ('INSTANT', 'AFTER_QUIET_HOURS', 'DAILY_DIGEST');

-- CreateEnum
CREATE TYPE "ProfileVisibilityAudience" AS ENUM ('PUBLIC', 'FRIENDS', 'FOLLOWERS', 'BEST_FRIENDS', 'DUO', 'TEAM', 'FAMILY', 'GUILD', 'COMMUNITIES', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ProfileCircleType" AS ENUM ('DUO_COUPLE', 'DUO_BEST_FRIENDS', 'DUO_SIBLINGS', 'DUO_GAMING', 'DUO_CREATIVE', 'TEAM', 'FAMILY', 'GUILD');

-- CreateEnum
CREATE TYPE "ProfileCircleStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "ProfileCircleMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'DECLINED', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "ProfileCircleJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProfileCircleActivityType" AS ENUM ('CHALLENGE_WON', 'GAME_WON', 'MOMENT_PUBLISHED', 'STORY_PUBLISHED', 'EVENT_COMPLETED', 'GIFT_RECEIVED', 'MEMBER_CONTRIBUTION');

-- CreateEnum
CREATE TYPE "ProfileWallMode" AS ENUM ('PUBLIC', 'FRIENDS', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProfileWallPostStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "ProfileMemoryType" AS ENUM ('AVATAR', 'COVER', 'USERNAME', 'THEME', 'SEASONAL_BADGE', 'PRECIOUS_GIFT', 'MOMENT_CAPTURE');

-- CreateEnum
CREATE TYPE "ProfileGuardStyle" AS ENUM ('GLASS', 'CRYSTAL', 'NEON', 'GOLD', 'PREMIUM', 'ANIME', 'CYBER', 'GALAXY', 'MAGIC');

-- CreateEnum
CREATE TYPE "ProfileCapturePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB', 'DESKTOP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProfileCaptureEventType" AS ENUM ('SCREENSHOT_ATTEMPT', 'SCREENSHOT_COMPLETED', 'SCREEN_RECORDING_STARTED', 'SCREEN_RECORDING_STOPPED', 'SCREEN_MIRRORING_STARTED', 'SCREEN_MIRRORING_STOPPED', 'SECURE_SURFACE_BLOCKED');

-- CreateEnum
CREATE TYPE "ProfileStatEventOperation" AS ENUM ('INCREMENT', 'SET_MAX', 'SET_VALUE');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SocialMatchPurpose" AS ENUM ('CHAT', 'PLAY', 'LEARN', 'CREATE');

-- CreateEnum
CREATE TYPE "SocialMatchPace" AS ENUM ('REALTIME', 'ASYNC', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "SocialMatchQueueStatus" AS ENUM ('QUEUED', 'MATCHED', 'LEFT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SocialMatchProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SocialMatchDecisionType" AS ENUM ('ACCEPT', 'DECLINE', 'BLOCK');

-- CreateEnum
CREATE TYPE "SocialConnectionIntentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION');

-- CreateEnum
CREATE TYPE "TournamentEntrantStatus" AS ENUM ('PENDING', 'READY', 'WITHDRAWN', 'ELIMINATED', 'CHAMPION', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "TournamentMemberStatus" AS ENUM ('INVITED', 'JOINED', 'LEFT');

-- CreateEnum
CREATE TYPE "TournamentMemberRole" AS ENUM ('CAPTAIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "TournamentMatchStatus" AS ENUM ('PENDING', 'WAITING', 'ACTIVE', 'COMPLETED', 'FORFEIT', 'REVIEW_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentNextSlot" AS ENUM ('FIRST', 'SECOND');

-- CreateTable
CREATE TABLE "AchievementDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "criteria" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,

    CONSTRAINT "AchievementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievementPreference" (
    "userId" TEXT NOT NULL,
    "selectedTitleGrantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAchievementPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AffinityGamePreference" (
    "userId" TEXT NOT NULL,
    "invitationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "friendsOnly" BOOLEAN NOT NULL DEFAULT true,
    "defaultShareAnswers" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffinityGamePreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserAppearancePreference" (
    "userId" TEXT NOT NULL,
    "selectedThemeKey" TEXT NOT NULL DEFAULT 'system',
    "secondaryThemeKey" TEXT,
    "themeBlendMode" TEXT NOT NULL DEFAULT 'OFF',
    "selectedIconPackKey" TEXT,
    "selectedAppIconKey" TEXT,
    "contrast" TEXT NOT NULL DEFAULT 'STANDARD',
    "reduceTransparency" BOOLEAN NOT NULL DEFAULT false,
    "animationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "animatedIconsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "uiSoundsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weatherEffectsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "effectIntensity" TEXT NOT NULL DEFAULT 'BALANCED',
    "automaticRotationMode" TEXT NOT NULL DEFAULT 'OFF',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAppearancePreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "calleeId" TEXT NOT NULL,
    "media" "CallMedia" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "creationKey" TEXT NOT NULL,
    "offerForwardedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedById" TEXT,
    "endReason" "CallEndReason",
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallEvent" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallReceipt" (
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallReceipt_pkey" PRIMARY KEY ("userId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "ChallengeReferenceSnapshot" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "challengeVersion" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeReferenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeResultSnapshot" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REFERENCE',
    "score" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "questionCount" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "feedback" JSONB,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "scoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeResultSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptKCharacterDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "originalWork" BOOLEAN NOT NULL DEFAULT true,
    "licenseKey" TEXT NOT NULL DEFAULT 'KNOWME_ORIGINAL',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConceptKCharacterDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptKAssetManifest" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventKey" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ALL',
    "deviceClass" TEXT NOT NULL DEFAULT 'ALL',
    "publicUrl" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "quarantinedAt" TIMESTAMP(3),
    "quarantineReason" TEXT,
    "quarantineSource" TEXT,
    "restoredAt" TIMESTAMP(3),
    "restoredById" TEXT,
    "createdById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConceptKAssetManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptKAssetDeliveryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sampleDate" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceClass" TEXT NOT NULL,
    "observedSha256" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptKAssetDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnimationPreference" (
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'AUTO',
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hapticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAnimationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AnimationTelemetryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "catalogVersion" INTEGER NOT NULL,
    "preferenceMode" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "assetBytes" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceClass" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimationTelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationArchive" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationArchive_pkey" PRIMARY KEY ("userId","conversationId")
);

-- CreateTable
CREATE TABLE "ConversationDraft" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationDraft_pkey" PRIMARY KEY ("userId","conversationId")
);

-- CreateTable
CREATE TABLE "ConversationFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationFolderAssignment" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationFolderAssignment_pkey" PRIMARY KEY ("userId","conversationId")
);

-- CreateTable
CREATE TABLE "ConversationPin" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConversationPin_pkey" PRIMARY KEY ("userId","conversationId")
);

-- CreateTable
CREATE TABLE "CosmeticItemDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slot" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "assetUrl" TEXT NOT NULL,
    "previewUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmeticItemDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticOwnership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalReference" TEXT,
    "grantedById" TEXT,
    "reason" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "CosmeticOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticEquipment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "equippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmeticEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmeticPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticPresetItem" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CosmeticPresetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticPresetState" (
    "userId" TEXT NOT NULL,
    "defaultPresetId" TEXT,
    "activePresetId" TEXT,
    "activationVersion" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmeticPresetState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CosmeticPresetActivation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "presetId" TEXT,
    "presetName" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "equipmentSnapshot" JSONB NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CosmeticPresetActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticOfferDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "priceKnowCoins" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmeticOfferDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticPurchaseReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "priceKnowCoins" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CosmeticPurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bio" TEXT,
    "category" TEXT NOT NULL,
    "visibility" "CreatorProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "CreatorProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CreatorFollow" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorPinnedPost" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorPinnedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorMetricDaily" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "postViews" INTEGER NOT NULL DEFAULT 0,
    "followsGained" INTEGER NOT NULL DEFAULT 0,
    "unfollows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorMetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorAudienceReceipt" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "metricKind" "CreatorMetricKind" NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorAudienceReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChestClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "questProgressId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CLAIMED',
    "idempotencyKey" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChestClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "engineKey" TEXT NOT NULL,
    "minPlayers" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "status" "GameCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "rules" JSONB NOT NULL,
    "initialConfig" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "GameDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "creationKey" TEXT NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'WAITING',
    "seed" TEXT NOT NULL,
    "initialState" JSONB NOT NULL,
    "state" JSONB NOT NULL,
    "stateHash" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "currentTurnPosition" INTEGER,
    "winnerUserId" TEXT,
    "result" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "GameParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "joinedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "GameAction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "stateHashBefore" TEXT NOT NULL,
    "stateHashAfter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameActionReceipt" (
    "sessionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameActionReceipt_pkey" PRIMARY KEY ("sessionId","actorId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "GameReplaySnapshot" (
    "sessionId" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "initialState" JSONB NOT NULL,
    "finalState" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "actionCount" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameReplaySnapshot_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "GameGovernanceEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameGovernanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLocalePreference" (
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "source" TEXT NOT NULL DEFAULT 'USER',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocalePreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DeviceAttestationChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAttestationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAttestation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "appIdentifier" TEXT NOT NULL,
    "keyIdentifier" TEXT,
    "verdict" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "entitlementKey" TEXT,
    "coinAmount" INTEGER,
    "durationDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "originalTransactionId" TEXT,
    "receiptHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "refundedAt" TIMESTAMP(3),
    "entitlementGrantId" TEXT,
    "ledgerEntryId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretPage" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "presentation" TEXT NOT NULL DEFAULT 'Pose-moi une question anonymement 👇',
    "defaultPrompt" TEXT NOT NULL DEFAULT 'Envoie-moi un message anonyme',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "profileEntryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowUnauthenticatedSenders" BOOLEAN NOT NULL DEFAULT true,
    "requireChallengeVerification" BOOLEAN NOT NULL DEFAULT false,
    "minimumAccountAgeHours" INTEGER NOT NULL DEFAULT 0,
    "dailyLimitPerSender" INTEGER NOT NULL DEFAULT 10,
    "acceptedCategories" TEXT NOT NULL DEFAULT 'QUESTION,COMPLIMENT,CONFESSION,FEEDBACK',
    "blockedTerms" JSONB NOT NULL DEFAULT '[]',
    "pausedUntil" TIMESTAMP(3),
    "publicMessageCountVisible" BOOLEAN NOT NULL DEFAULT false,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretCampaign" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'QUESTION',
    "source" TEXT NOT NULL DEFAULT 'SHARED_LINK',
    "status" "SecretCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "maximumMessages" INTEGER,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretMessage" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "campaignId" TEXT,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "senderTokenHash" TEXT NOT NULL,
    "senderAuthenticated" BOOLEAN NOT NULL DEFAULT false,
    "moderationRiskScore" INTEGER NOT NULL DEFAULT 0,
    "status" "SecretMessageStatus" NOT NULL DEFAULT 'DELIVERED',
    "openedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretBlock" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "senderTokenHash" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretPublicReply" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "shareCaption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretPublicReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardPreference" (
    "userId" TEXT NOT NULL,
    "weeklyXpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "displayAlias" TEXT,
    "optedInAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserMediaDownloadPreference" (
    "userId" TEXT NOT NULL,
    "wifiKinds" JSONB NOT NULL,
    "cellularKinds" JSONB NOT NULL,
    "roamingKinds" JSONB NOT NULL,
    "backgroundDownloads" BOOLEAN NOT NULL DEFAULT false,
    "respectDataSaver" BOOLEAN NOT NULL DEFAULT true,
    "maxCacheMb" INTEGER NOT NULL DEFAULT 512,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMediaDownloadPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MediaUploadSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "conversationId" TEXT,
    "maxBytes" INTEGER NOT NULL,
    "allowedMime" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "declaredMime" TEXT NOT NULL,
    "detectedMime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "conversationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "scannerVerdict" TEXT NOT NULL,
    "scannerReference" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAccessGrant" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "granteeId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaDownloadGrant" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaDownloadGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("userId","messageId")
);

-- CreateTable
CREATE TABLE "AbuseEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "contentHash" TEXT,
    "targetId" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'ALLOWED',
    "reasonCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbuseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NexusAccountLink" (
    "id" TEXT NOT NULL,
    "knowMeUserId" TEXT NOT NULL,
    "nexusUserId" TEXT NOT NULL,
    "lastPlan" TEXT NOT NULL DEFAULT 'free',
    "lastStatus" TEXT NOT NULL DEFAULT 'active',
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NexusAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NexusIntegrationReceipt" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "actorNexusUserId" TEXT NOT NULL,
    "actorKnowMeUserId" TEXT,
    "risk" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "approvalId" TEXT,
    "outcome" TEXT NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NexusIntegrationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NexusSocialConversation" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NexusSocialConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NexusSocialReply" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "invokingUserId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "invocationKind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "route" TEXT,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NexusSocialReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationCenterPreference" (
    "userId" TEXT NOT NULL,
    "masterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "realtimeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "digestMode" "NotificationCenterDigestMode" NOT NULL DEFAULT 'INSTANT',
    "dailyDigestMinute" INTEGER NOT NULL DEFAULT 480,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietStartMinute" INTEGER NOT NULL DEFAULT 1320,
    "quietEndMinute" INTEGER NOT NULL DEFAULT 420,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "categorySettings" JSONB NOT NULL DEFAULT '{}',
    "mutedTypes" JSONB NOT NULL DEFAULT '[]',
    "mutedCircleIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationCenterPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "NotificationCenterUserState" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationCenterUserState_pkey" PRIMARY KEY ("notificationId","userId")
);

-- CreateTable
CREATE TABLE "NotificationCenterActionReceipt" (
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationCenterActionReceipt_pkey" PRIMARY KEY ("idempotencyKey")
);

-- CreateTable
CREATE TABLE "NotificationCenterDigestQueueItem" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "digestMode" "NotificationCenterDigestMode" NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "NotificationCenterDigestQueueStatus" NOT NULL DEFAULT 'PENDING',
    "processingToken" TEXT,
    "processingAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationCenterDigestQueueItem_pkey" PRIMARY KEY ("notificationId")
);

-- CreateTable
CREATE TABLE "NotificationCenterDigestBatch" (
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "digestMode" "NotificationCenterDigestMode" NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "notificationId" TEXT,
    "itemCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationCenterDigestBatch_pkey" PRIMARY KEY ("idempotencyKey")
);

-- CreateTable
CREATE TABLE "CommerceProduct" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "fulfillmentType" TEXT NOT NULL,
    "fulfillmentReference" TEXT NOT NULL,
    "fulfillmentQuantity" INTEGER NOT NULL DEFAULT 1,
    "requiresVerification" BOOLEAN NOT NULL DEFAULT false,
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercePrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalProductId" TEXT,
    "platform" TEXT NOT NULL,
    "countryCode" TEXT,
    "currency" TEXT NOT NULL,
    "unitAmount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "expectedAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "countryCode" TEXT,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerCheckoutId" TEXT,
    "checkoutUrl" TEXT,
    "returnUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalTransactionId" TEXT,
    "externalEventId" TEXT,
    "amount" INTEGER,
    "currency" TEXT,
    "rawStatus" TEXT,
    "payloadHash" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "attemptId" TEXT,
    "provider" TEXT NOT NULL,
    "externalRefundId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInvoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "subtotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "headers" JSONB,
    "payload" JSONB NOT NULL,
    "errorCode" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentFraudLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orderId" TEXT,
    "provider" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "fingerprintHash" TEXT,
    "ipHash" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "PaymentFraudLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositiveChallenge" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "challengeDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "creatorConfirmedAt" TIMESTAMP(3),
    "recipientConfirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositiveChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositiveChallengeEvent" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositiveChallengeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyPolicyVersion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyConsentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "action" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "PrivacyConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyPreference" (
    "userId" TEXT NOT NULL,
    "profileVisibility" TEXT NOT NULL DEFAULT 'FRIENDS',
    "cosmeticVisibility" TEXT NOT NULL DEFAULT 'FOLLOW_PROFILE',
    "hiddenCosmeticSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discoverability" BOOLEAN NOT NULL DEFAULT true,
    "personalizedRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "readReceipts" BOOLEAN NOT NULL DEFAULT true,
    "activityStatus" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "resultMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT 'DELETE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "legalBasis" TEXT NOT NULL,
    "createdById" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionExecution" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "anonymizedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "DataRetentionExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleOwnershipTransfer" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" "ProfileCircleTransferStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleOwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleMoment" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "type" "ProfileCircleMomentType" NOT NULL,
    "text" TEXT,
    "assetId" TEXT,
    "giftInstanceId" TEXT,
    "status" "ProfileCircleContentStatus" NOT NULL DEFAULT 'PENDING',
    "audience" "ProfileCircleContentAudience" NOT NULL DEFAULT 'MEMBERS',
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleStory" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "type" "ProfileCircleStoryType" NOT NULL,
    "text" TEXT,
    "assetId" TEXT,
    "giftInstanceId" TEXT,
    "status" "ProfileCircleContentStatus" NOT NULL DEFAULT 'PENDING',
    "audience" "ProfileCircleContentAudience" NOT NULL DEFAULT 'PUBLIC',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileFamilyRelation" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "firstUserId" TEXT NOT NULL,
    "secondUserId" TEXT NOT NULL,
    "type" "ProfileFamilyRelationType" NOT NULL,
    "inverseType" "ProfileFamilyRelationType" NOT NULL,
    "label" TEXT,
    "status" "ProfileFamilyRelationStatus" NOT NULL DEFAULT 'PENDING',
    "proposedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileFamilyRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationPreference" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "invitationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "membershipEnabled" BOOLEAN NOT NULL DEFAULT true,
    "governanceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "familyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "realtimeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mutedCircleIds" JSONB NOT NULL DEFAULT '[]',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietStartMinute" INTEGER NOT NULL DEFAULT 1320,
    "quietEndMinute" INTEGER NOT NULL DEFAULT 420,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "digestMode" "ProfileCircleNotificationDigestMode" NOT NULL DEFAULT 'OFF',
    "digestMinuteOfDay" INTEGER NOT NULL DEFAULT 480,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationChannelPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "ProfileCircleNotificationTransportChannel" NOT NULL,
    "optionalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minimumPriority" "ProfileCircleNotificationPriority" NOT NULL DEFAULT 'LOW',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationChannelPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationProviderState" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "channel" "ProfileCircleNotificationTransportChannel" NOT NULL,
    "circuitStatus" "ProfileCircleNotificationProviderCircuitStatus" NOT NULL DEFAULT 'CLOSED',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3),
    "nextProbeAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileCircleNotificationProviderState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationSuppression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "ProfileCircleNotificationTransportChannel" NOT NULL,
    "addressHash" TEXT,
    "reason" "ProfileCircleNotificationSuppressionReason" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationRateBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileCircleNotificationRateBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "channel" "ProfileCircleNotificationTransportChannel" NOT NULL,
    "subject" TEXT,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationDeadLetter" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT,
    "userId" TEXT NOT NULL,
    "channel" "ProfileCircleNotificationTransportChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "priority" "ProfileCircleNotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "reasonCode" TEXT NOT NULL,
    "payload" JSONB,
    "status" "ProfileCircleNotificationDeadLetterStatus" NOT NULL DEFAULT 'OPEN',
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayingAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationWebhookReceipt" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "attemptId" TEXT,
    "signatureHash" TEXT NOT NULL,
    "status" "ProfileCircleNotificationWebhookReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorCode" TEXT,
    "metadata" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationOperationalAlert" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "ProfileCircleNotificationPriority" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationOperationalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationSchedulerLease" (
    "key" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "leaseToken" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationSchedulerLease_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationEndpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "ProfileCircleNotificationTransportChannel" NOT NULL,
    "addressHash" TEXT NOT NULL,
    "addressCiphertext" TEXT NOT NULL,
    "platform" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "status" "ProfileCircleNotificationEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationTransportAttempt" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT,
    "userId" TEXT NOT NULL,
    "channel" "ProfileCircleNotificationTransportChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ProfileCircleNotificationTransportAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationTransportAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationDigestSubscription" (
    "userId" TEXT NOT NULL,
    "weeklyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "groupingMode" "ProfileCircleNotificationGroupingMode" NOT NULL DEFAULT 'BY_CIRCLE',
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "weeklyDay" INTEGER NOT NULL DEFAULT 1,
    "minuteOfDay" INTEGER NOT NULL DEFAULT 480,
    "lastWeeklyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationDigestSubscription_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationDispatch" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "circleId" TEXT,
    "actorUserId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleNotificationRecipient" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ProfileCircleNotificationRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryMode" "ProfileCircleNotificationDeliveryMode" NOT NULL DEFAULT 'INSTANT',
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingToken" TEXT,
    "processingAt" TIMESTAMP(3),
    "notificationId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "suppressedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleNotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileExperience" (
    "userId" TEXT NOT NULL,
    "coverAssetId" TEXT,
    "coverVideoAssetId" TEXT,
    "frameAssetId" TEXT,
    "themeKey" TEXT NOT NULL DEFAULT 'knowme-classic',
    "effectKey" TEXT,
    "intelligentBio" JSONB,
    "influencerMode" BOOLEAN NOT NULL DEFAULT false,
    "wallMode" "ProfileWallMode" NOT NULL DEFAULT 'FRIENDS',
    "profileLocked" BOOLEAN NOT NULL DEFAULT false,
    "profileEvolutionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weatherEffectsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "seasonalEffectsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "birthdayEffectsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "animatedAvatarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicShortCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileExperience_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfileSectionVisibility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "audience" "ProfileVisibilityAudience" NOT NULL DEFAULT 'FRIENDS',
    "allowedWhenLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileSectionVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileStatSnapshot" (
    "userId" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileStatSnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfileCircle" (
    "id" TEXT NOT NULL,
    "type" "ProfileCircleType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "status" "ProfileCircleStatus" NOT NULL DEFAULT 'PENDING',
    "bannerAssetId" TEXT,
    "emblemAssetId" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#45e6bd',
    "sharedBio" TEXT,
    "animationKey" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "maxMembers" INTEGER NOT NULL,
    "visibility" "ProfileVisibilityAudience" NOT NULL DEFAULT 'PUBLIC',
    "joinable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleMember" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" "ProfileCircleMemberStatus" NOT NULL DEFAULT 'INVITED',
    "bioFragment" TEXT,
    "portraitPosition" INTEGER,
    "consentedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleJoinRequest" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" "ProfileCircleJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCircleJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCircleActivityEvent" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "ProfileCircleActivityType" NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileCircleActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileTimelineEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaAssetId" TEXT,
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "visibility" "ProfileVisibilityAudience" NOT NULL DEFAULT 'FRIENDS',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileMemoryVaultItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ProfileMemoryType" NOT NULL,
    "label" TEXT NOT NULL,
    "assetId" TEXT,
    "privateValue" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "metadata" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileMemoryVaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileWallPost" (
    "id" TEXT NOT NULL,
    "profileOwnerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "text" TEXT,
    "assetId" TEXT,
    "giftInstanceId" TEXT,
    "status" "ProfileWallPostStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "ProfileVisibilityAudience" NOT NULL DEFAULT 'FRIENDS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileWallPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileGiftShowcaseItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "giftInstanceId" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "visibility" "ProfileVisibilityAudience" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileGiftShowcaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileGuardPreference" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "style" "ProfileGuardStyle" NOT NULL DEFAULT 'GLASS',
    "warnViewer" BOOLEAN NOT NULL DEFAULT true,
    "notifyOwner" BOOLEAN NOT NULL DEFAULT false,
    "premiumGranularControl" BOOLEAN NOT NULL DEFAULT false,
    "platformDisclosureAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileGuardPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfileCaptureSecurityEvent" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "viewerUserId" TEXT,
    "platform" "ProfileCapturePlatform" NOT NULL,
    "eventType" "ProfileCaptureEventType" NOT NULL,
    "scope" TEXT NOT NULL,
    "nativeSignal" BOOLEAN NOT NULL DEFAULT false,
    "attestationValid" BOOLEAN NOT NULL DEFAULT false,
    "ownerNotified" BOOLEAN NOT NULL DEFAULT false,
    "clientOccurredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileCaptureSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileShareCard" (
    "userId" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "themeKey" TEXT NOT NULL DEFAULT 'knowme-classic',
    "qrPayload" TEXT NOT NULL,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "lastSharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileShareCard_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfileCompatibilitySnapshot" (
    "pairKey" TEXT NOT NULL,
    "firstUserId" TEXT NOT NULL,
    "secondUserId" TEXT NOT NULL,
    "overallBps" INTEGER NOT NULL,
    "categories" JSONB NOT NULL DEFAULT '[]',
    "explanation" JSONB NOT NULL DEFAULT '[]',
    "signalVersion" INTEGER NOT NULL DEFAULT 1,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCompatibilitySnapshot_pkey" PRIMARY KEY ("pairKey")
);

-- CreateTable
CREATE TABLE "ProfileStatEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" "ProfileStatEventOperation" NOT NULL,
    "numericValue" INTEGER NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileStatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgression" (
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgression_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "XpLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyQuestProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questKey" TEXT NOT NULL,
    "questDate" TIMESTAMP(3) NOT NULL,
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyQuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyQuestContribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questKey" TEXT NOT NULL,
    "questDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyQuestContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedMessage" (
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedMessage_pkey" PRIMARY KEY ("userId","messageId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "knowCoins" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeVersion" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "questionCount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeQuestion" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "prompt" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeParticipant" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeVersion" INTEGER NOT NULL DEFAULT 1,
    "score" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeAnswer" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "targetAccountId" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "staffRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "badgeLabel" TEXT NOT NULL DEFAULT 'Équipe KnowMe',
    "shieldStyle" TEXT NOT NULL DEFAULT 'GOLD',
    "grantsAdminAccess" BOOLEAN NOT NULL DEFAULT true,
    "previousUserRole" TEXT NOT NULL DEFAULT 'USER',
    "reason" TEXT NOT NULL,
    "activatedById" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRoleGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "externalReference" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "reason" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowCoinWallet" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowCoinWallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "KnowCoinLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowCoinLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "amount" INTEGER NOT NULL,
    "dailyLimitPerUser" INTEGER NOT NULL,
    "maxPerEntity" INTEGER NOT NULL DEFAULT 1,
    "minQuestions" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "reasonCode" TEXT,
    "explanation" TEXT,
    "ledgerEntryId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "RewardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "requiresVerification" BOOLEAN NOT NULL DEFAULT false,
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPrice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalPriceId" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'ALL',
    "countryCode" TEXT,
    "currency" TEXT NOT NULL,
    "unitAmount" INTEGER NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'MONTH',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlanEntitlement" (
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPlanEntitlement_pkey" PRIMARY KEY ("planId","key")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "priceId" TEXT,
    "provider" TEXT NOT NULL,
    "externalSubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "latestEventTime" TIMESTAMP(3) NOT NULL,
    "latestExternalEventId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "signatureVersion" TEXT NOT NULL DEFAULT 'hmac-sha256-v1',
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityVerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "level" TEXT NOT NULL DEFAULT 'IDENTITY',
    "displayNameClaim" TEXT,
    "countryCode" TEXT,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewStartedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "decisionReason" TEXT,
    "decisionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityEvidenceReference" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "opaqueReference" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityEvidenceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityVerificationDecision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "nextStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityVerificationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "exposeToClient" BOOLEAN NOT NULL DEFAULT false,
    "riskLevel" TEXT NOT NULL DEFAULT 'NORMAL',
    "owner" TEXT,
    "reviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagRule" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "platform" TEXT,
    "country" TEXT,
    "minVersion" TEXT,
    "rolloutPercentage" INTEGER,
    "audience" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlagRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagOverride" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlagOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalReference" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatibilitySnapshot" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "commonSignals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompatibilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSecurity" (
    "userId" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpCiphertext" TEXT,
    "totpIv" TEXT,
    "totpTag" TEXT,
    "totpConfirmedAt" TIMESTAMP(3),
    "lastTotpStep" INTEGER,
    "failedTwoFactorAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSecurity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SecurityRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceTokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "platform" TEXT,
    "createdBySessionId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trustedUntil" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBySessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReauthenticationProof" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "assurance" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReauthenticationProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "sessionId" TEXT,
    "deviceId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "resolveCount" INTEGER NOT NULL DEFAULT 0,
    "lastResolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortLinkReceipt" (
    "ownerId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortLinkReceipt_pkey" PRIMARY KEY ("ownerId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "SocialMatchPreference" (
    "userId" TEXT NOT NULL,
    "matchmakingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowNewPeople" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMatchPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SocialMatchQueueEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "SocialMatchPurpose" NOT NULL,
    "pace" "SocialMatchPace" NOT NULL,
    "languages" JSONB NOT NULL,
    "topics" JSONB NOT NULL,
    "availability" JSONB NOT NULL,
    "criteriaHash" TEXT NOT NULL,
    "status" "SocialMatchQueueStatus" NOT NULL DEFAULT 'QUEUED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "matchedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMatchQueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMatchProposal" (
    "id" TEXT NOT NULL,
    "firstUserId" TEXT NOT NULL,
    "secondUserId" TEXT NOT NULL,
    "firstEntryId" TEXT NOT NULL,
    "secondEntryId" TEXT NOT NULL,
    "status" "SocialMatchProposalStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER NOT NULL,
    "explanation" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMatchProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMatchDecision" (
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" "SocialMatchDecisionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMatchDecision_pkey" PRIMARY KEY ("proposalId","userId")
);

-- CreateTable
CREATE TABLE "SocialMatchBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMatchBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "SocialMatchEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subjectId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMatchReceipt" (
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMatchReceipt_pkey" PRIMARY KEY ("userId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "SocialConnectionIntent" (
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wantsFriendship" BOOLEAN NOT NULL DEFAULT false,
    "wantsConversation" BOOLEAN NOT NULL DEFAULT false,
    "status" "SocialConnectionIntentStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnectionIntent_pkey" PRIMARY KEY ("proposalId","userId")
);

-- CreateTable
CREATE TABLE "SocialConnectionOutcome" (
    "proposalId" TEXT NOT NULL,
    "friendshipId" TEXT,
    "conversationId" TEXT,
    "friendshipCreatedAt" TIMESTAMP(3),
    "conversationCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnectionOutcome_pkey" PRIMARY KEY ("proposalId")
);

-- CreateTable
CREATE TABLE "SocialConnectionEvent" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialConnectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialConnectionReceipt" (
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialConnectionReceipt_pkey" PRIMARY KEY ("userId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "UserActivityStreak" (
    "userId" TEXT NOT NULL,
    "currentDays" INTEGER NOT NULL DEFAULT 0,
    "longestDays" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserActivityStreak_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StreakActivityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreakActivityDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "creationKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gameDefinitionId" TEXT NOT NULL,
    "gameDefinitionKey" TEXT NOT NULL,
    "gameDefinitionVersion" INTEGER NOT NULL,
    "format" "TournamentFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "teamSize" INTEGER NOT NULL DEFAULT 1,
    "maxEntrants" INTEGER NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "bracketSeed" TEXT,
    "bracketSize" INTEGER,
    "championEntrantId" TEXT,
    "registrationClosesAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEntrant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER,
    "status" "TournamentEntrantStatus" NOT NULL DEFAULT 'PENDING',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "eliminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentEntrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEntrantMember" (
    "tournamentId" TEXT NOT NULL,
    "entrantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TournamentMemberRole" NOT NULL,
    "status" "TournamentMemberStatus" NOT NULL DEFAULT 'INVITED',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentEntrantMember_pkey" PRIMARY KEY ("tournamentId","userId")
);

-- CreateTable
CREATE TABLE "TournamentMatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "firstEntrantId" TEXT,
    "secondEntrantId" TEXT,
    "winnerEntrantId" TEXT,
    "gameSessionId" TEXT,
    "status" "TournamentMatchStatus" NOT NULL DEFAULT 'PENDING',
    "nextMatchId" TEXT,
    "nextSlot" "TournamentNextSlot",
    "version" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resolutionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEvent" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subjectId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentReceipt" (
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentReceipt_pkey" PRIMARY KEY ("userId","idempotencyKey")
);

-- CreateIndex
CREATE INDEX "AchievementDefinition_type_active_idx" ON "AchievementDefinition"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementDefinition_key_version_key" ON "AchievementDefinition"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementGrant_idempotencyKey_key" ON "AchievementGrant"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AchievementGrant_userId_revokedAt_grantedAt_idx" ON "AchievementGrant"("userId", "revokedAt", "grantedAt");

-- CreateIndex
CREATE INDEX "AchievementGrant_referenceType_referenceId_idx" ON "AchievementGrant"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementGrant_userId_definitionId_key" ON "AchievementGrant"("userId", "definitionId");

-- CreateIndex
CREATE INDEX "UserAchievementPreference_selectedTitleGrantId_idx" ON "UserAchievementPreference"("selectedTitleGrantId");

-- CreateIndex
CREATE INDEX "AffinityGamePreference_invitationsEnabled_friendsOnly_idx" ON "AffinityGamePreference"("invitationsEnabled", "friendsOnly");

-- CreateIndex
CREATE INDEX "UserAppearancePreference_selectedThemeKey_updatedAt_idx" ON "UserAppearancePreference"("selectedThemeKey", "updatedAt");

-- CreateIndex
CREATE INDEX "UserAppearancePreference_secondaryThemeKey_updatedAt_idx" ON "UserAppearancePreference"("secondaryThemeKey", "updatedAt");

-- CreateIndex
CREATE INDEX "UserAppearancePreference_selectedIconPackKey_updatedAt_idx" ON "UserAppearancePreference"("selectedIconPackKey", "updatedAt");

-- CreateIndex
CREATE INDEX "CallSession_callerId_createdAt_idx" ON "CallSession"("callerId", "createdAt");

-- CreateIndex
CREATE INDEX "CallSession_calleeId_createdAt_idx" ON "CallSession"("calleeId", "createdAt");

-- CreateIndex
CREATE INDEX "CallSession_status_expiresAt_idx" ON "CallSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "CallSession_callerId_calleeId_status_idx" ON "CallSession"("callerId", "calleeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CallSession_callerId_creationKey_key" ON "CallSession"("callerId", "creationKey");

-- CreateIndex
CREATE INDEX "CallEvent_callId_createdAt_idx" ON "CallEvent"("callId", "createdAt");

-- CreateIndex
CREATE INDEX "CallEvent_actorId_action_createdAt_idx" ON "CallEvent"("actorId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "CallReceipt_callId_idx" ON "CallReceipt"("callId");

-- CreateIndex
CREATE INDEX "CallReceipt_createdAt_idx" ON "CallReceipt"("createdAt");

-- CreateIndex
CREATE INDEX "ChallengeReferenceSnapshot_createdById_createdAt_idx" ON "ChallengeReferenceSnapshot"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeReferenceSnapshot_challengeId_challengeVersion_key" ON "ChallengeReferenceSnapshot"("challengeId", "challengeVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeResultSnapshot_participantId_key" ON "ChallengeResultSnapshot"("participantId");

-- CreateIndex
CREATE INDEX "ChallengeResultSnapshot_userId_completedAt_id_idx" ON "ChallengeResultSnapshot"("userId", "completedAt", "id");

-- CreateIndex
CREATE INDEX "ChallengeResultSnapshot_challengeId_challengeVersion_comple_idx" ON "ChallengeResultSnapshot"("challengeId", "challengeVersion", "completedAt");

-- CreateIndex
CREATE INDEX "ChallengeResultSnapshot_status_createdAt_idx" ON "ChallengeResultSnapshot"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ConceptKCharacterDefinition_key_active_version_idx" ON "ConceptKCharacterDefinition"("key", "active", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptKCharacterDefinition_key_version_key" ON "ConceptKCharacterDefinition"("key", "version");

-- CreateIndex
CREATE INDEX "ConceptKAssetManifest_eventKey_variant_active_quarantinedAt_idx" ON "ConceptKAssetManifest"("eventKey", "variant", "active", "quarantinedAt", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ConceptKAssetManifest_platform_deviceClass_active_quarantin_idx" ON "ConceptKAssetManifest"("platform", "deviceClass", "active", "quarantinedAt");

-- CreateIndex
CREATE INDEX "ConceptKAssetManifest_characterId_active_version_idx" ON "ConceptKAssetManifest"("characterId", "active", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptKAssetManifest_key_version_key" ON "ConceptKAssetManifest"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptKAssetDeliveryEvent_idempotencyKey_key" ON "ConceptKAssetDeliveryEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ConceptKAssetDeliveryEvent_assetId_createdAt_outcome_idx" ON "ConceptKAssetDeliveryEvent"("assetId", "createdAt", "outcome");

-- CreateIndex
CREATE INDEX "ConceptKAssetDeliveryEvent_userId_createdAt_idx" ON "ConceptKAssetDeliveryEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptKAssetDeliveryEvent_userId_assetId_sampleDate_key" ON "ConceptKAssetDeliveryEvent"("userId", "assetId", "sampleDate");

-- CreateIndex
CREATE INDEX "UserAnimationPreference_mode_updatedAt_idx" ON "UserAnimationPreference"("mode", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimationTelemetryEvent_idempotencyKey_key" ON "AnimationTelemetryEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AnimationTelemetryEvent_userId_createdAt_id_idx" ON "AnimationTelemetryEvent"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AnimationTelemetryEvent_eventKey_outcome_createdAt_idx" ON "AnimationTelemetryEvent"("eventKey", "outcome", "createdAt");

-- CreateIndex
CREATE INDEX "AnimationTelemetryEvent_platform_deviceClass_createdAt_idx" ON "AnimationTelemetryEvent"("platform", "deviceClass", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationArchive_userId_archivedAt_idx" ON "ConversationArchive"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "ConversationArchive_conversationId_idx" ON "ConversationArchive"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationDraft_userId_updatedAt_idx" ON "ConversationDraft"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConversationDraft_conversationId_idx" ON "ConversationDraft"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationFolder_userId_position_updatedAt_idx" ON "ConversationFolder"("userId", "position", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationFolder_userId_normalizedName_key" ON "ConversationFolder"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "ConversationFolderAssignment_folderId_assignedAt_idx" ON "ConversationFolderAssignment"("folderId", "assignedAt");

-- CreateIndex
CREATE INDEX "ConversationPin_userId_position_idx" ON "ConversationPin"("userId", "position");

-- CreateIndex
CREATE INDEX "ConversationPin_userId_pinnedAt_idx" ON "ConversationPin"("userId", "pinnedAt");

-- CreateIndex
CREATE INDEX "ConversationPin_conversationId_idx" ON "ConversationPin"("conversationId");

-- CreateIndex
CREATE INDEX "CosmeticItemDefinition_active_slot_startsAt_endsAt_idx" ON "CosmeticItemDefinition"("active", "slot", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CosmeticItemDefinition_key_active_version_idx" ON "CosmeticItemDefinition"("key", "active", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticItemDefinition_key_version_key" ON "CosmeticItemDefinition"("key", "version");

-- CreateIndex
CREATE INDEX "CosmeticOwnership_userId_revokedAt_acquiredAt_idx" ON "CosmeticOwnership"("userId", "revokedAt", "acquiredAt");

-- CreateIndex
CREATE INDEX "CosmeticOwnership_itemId_revokedAt_idx" ON "CosmeticOwnership"("itemId", "revokedAt");

-- CreateIndex
CREATE INDEX "CosmeticOwnership_source_externalReference_idx" ON "CosmeticOwnership"("source", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticOwnership_userId_itemId_key" ON "CosmeticOwnership"("userId", "itemId");

-- CreateIndex
CREATE INDEX "CosmeticEquipment_userId_updatedAt_idx" ON "CosmeticEquipment"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CosmeticEquipment_itemId_idx" ON "CosmeticEquipment"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticEquipment_userId_slot_key" ON "CosmeticEquipment"("userId", "slot");

-- CreateIndex
CREATE INDEX "CosmeticPreset_userId_updatedAt_idx" ON "CosmeticPreset"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticPreset_userId_normalizedName_key" ON "CosmeticPreset"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "CosmeticPresetItem_itemId_idx" ON "CosmeticPresetItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticPresetItem_presetId_slot_key" ON "CosmeticPresetItem"("presetId", "slot");

-- CreateIndex
CREATE INDEX "CosmeticPresetState_defaultPresetId_idx" ON "CosmeticPresetState"("defaultPresetId");

-- CreateIndex
CREATE INDEX "CosmeticPresetState_activePresetId_idx" ON "CosmeticPresetState"("activePresetId");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticPresetActivation_idempotencyKey_key" ON "CosmeticPresetActivation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CosmeticPresetActivation_userId_activatedAt_idx" ON "CosmeticPresetActivation"("userId", "activatedAt");

-- CreateIndex
CREATE INDEX "CosmeticPresetActivation_presetId_activatedAt_idx" ON "CosmeticPresetActivation"("presetId", "activatedAt");

-- CreateIndex
CREATE INDEX "CosmeticOfferDefinition_active_startsAt_endsAt_idx" ON "CosmeticOfferDefinition"("active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CosmeticOfferDefinition_itemId_active_version_idx" ON "CosmeticOfferDefinition"("itemId", "active", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticOfferDefinition_key_version_key" ON "CosmeticOfferDefinition"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticPurchaseReceipt_idempotencyKey_key" ON "CosmeticPurchaseReceipt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticPurchaseReceipt_ledgerEntryId_key" ON "CosmeticPurchaseReceipt"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "CosmeticPurchaseReceipt_userId_purchasedAt_idx" ON "CosmeticPurchaseReceipt"("userId", "purchasedAt");

-- CreateIndex
CREATE INDEX "CosmeticPurchaseReceipt_offerId_purchasedAt_idx" ON "CosmeticPurchaseReceipt"("offerId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticPurchaseReceipt_userId_itemId_key" ON "CosmeticPurchaseReceipt"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_slug_key" ON "CreatorProfile"("slug");

-- CreateIndex
CREATE INDEX "CreatorProfile_status_visibility_updatedAt_idx" ON "CreatorProfile"("status", "visibility", "updatedAt");

-- CreateIndex
CREATE INDEX "CreatorProfile_category_followerCount_idx" ON "CreatorProfile"("category", "followerCount");

-- CreateIndex
CREATE INDEX "CreatorFollow_followerId_createdAt_idx" ON "CreatorFollow"("followerId", "createdAt");

-- CreateIndex
CREATE INDEX "CreatorFollow_creatorId_createdAt_idx" ON "CreatorFollow"("creatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorFollow_creatorId_followerId_key" ON "CreatorFollow"("creatorId", "followerId");

-- CreateIndex
CREATE INDEX "CreatorPinnedPost_postId_idx" ON "CreatorPinnedPost"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorPinnedPost_creatorId_postId_key" ON "CreatorPinnedPost"("creatorId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorPinnedPost_creatorId_position_key" ON "CreatorPinnedPost"("creatorId", "position");

-- CreateIndex
CREATE INDEX "CreatorMetricDaily_metricDate_creatorId_idx" ON "CreatorMetricDaily"("metricDate", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorMetricDaily_creatorId_metricDate_key" ON "CreatorMetricDaily"("creatorId", "metricDate");

-- CreateIndex
CREATE INDEX "CreatorAudienceReceipt_expiresAt_idx" ON "CreatorAudienceReceipt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorAudienceReceipt_creatorId_metricKind_subjectHash_met_key" ON "CreatorAudienceReceipt"("creatorId", "metricKind", "subjectHash", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChestClaim_idempotencyKey_key" ON "DailyChestClaim"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChestClaim_ledgerEntryId_key" ON "DailyChestClaim"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "DailyChestClaim_userId_claimedAt_idx" ON "DailyChestClaim"("userId", "claimedAt");

-- CreateIndex
CREATE INDEX "DailyChestClaim_questProgressId_idx" ON "DailyChestClaim"("questProgressId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChestClaim_userId_claimDate_key" ON "DailyChestClaim"("userId", "claimDate");

-- CreateIndex
CREATE INDEX "GameDefinition_status_key_version_idx" ON "GameDefinition"("status", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "GameDefinition_key_version_key" ON "GameDefinition"("key", "version");

-- CreateIndex
CREATE INDEX "GameSession_ownerId_status_updatedAt_idx" ON "GameSession"("ownerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "GameSession_status_expiresAt_idx" ON "GameSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "GameSession_definitionKey_definitionVersion_createdAt_idx" ON "GameSession"("definitionKey", "definitionVersion", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_ownerId_creationKey_key" ON "GameSession"("ownerId", "creationKey");

-- CreateIndex
CREATE INDEX "GameParticipant_userId_status_updatedAt_idx" ON "GameParticipant"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "GameParticipant_sessionId_status_position_idx" ON "GameParticipant"("sessionId", "status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_sessionId_position_key" ON "GameParticipant"("sessionId", "position");

-- CreateIndex
CREATE INDEX "GameAction_actorId_createdAt_idx" ON "GameAction"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "GameAction_sessionId_createdAt_idx" ON "GameAction"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameAction_sessionId_sequence_key" ON "GameAction"("sessionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "GameAction_sessionId_actorId_idempotencyKey_key" ON "GameAction"("sessionId", "actorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "GameActionReceipt_createdAt_idx" ON "GameActionReceipt"("createdAt");

-- CreateIndex
CREATE INDEX "GameReplaySnapshot_definitionKey_definitionVersion_createdA_idx" ON "GameReplaySnapshot"("definitionKey", "definitionVersion", "createdAt");

-- CreateIndex
CREATE INDEX "GameGovernanceEvent_sessionId_createdAt_idx" ON "GameGovernanceEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "GameGovernanceEvent_actorId_createdAt_idx" ON "GameGovernanceEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "UserLocalePreference_locale_updatedAt_idx" ON "UserLocalePreference"("locale", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAttestationChallenge_nonceHash_key" ON "DeviceAttestationChallenge"("nonceHash");

-- CreateIndex
CREATE INDEX "DeviceAttestationChallenge_userId_sessionId_platform_action_idx" ON "DeviceAttestationChallenge"("userId", "sessionId", "platform", "action", "expiresAt", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAttestation_tokenHash_key" ON "DeviceAttestation"("tokenHash");

-- CreateIndex
CREATE INDEX "DeviceAttestation_userId_deviceId_platform_action_expiresAt_idx" ON "DeviceAttestation"("userId", "deviceId", "platform", "action", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "DeviceAttestation_provider_appIdentifier_verdict_idx" ON "DeviceAttestation"("provider", "appIdentifier", "verdict");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_key_key" ON "StoreProduct"("key");

-- CreateIndex
CREATE INDEX "StoreProduct_active_platform_kind_idx" ON "StoreProduct"("active", "platform", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_provider_platform_externalProductId_key" ON "StoreProduct"("provider", "platform", "externalProductId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_transactionId_key" ON "PurchaseReceipt"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_receiptHash_key" ON "PurchaseReceipt"("receiptHash");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_userId_status_createdAt_idx" ON "PurchaseReceipt"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_productId_purchasedAt_idx" ON "PurchaseReceipt"("productId", "purchasedAt");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_provider_originalTransactionId_idx" ON "PurchaseReceipt"("provider", "originalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "SecretPage_ownerId_key" ON "SecretPage"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "SecretPage_slug_key" ON "SecretPage"("slug");

-- CreateIndex
CREATE INDEX "SecretPage_enabled_profileEntryEnabled_idx" ON "SecretPage"("enabled", "profileEntryEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "SecretCampaign_token_key" ON "SecretCampaign"("token");

-- CreateIndex
CREATE INDEX "SecretCampaign_pageId_status_createdAt_idx" ON "SecretCampaign"("pageId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SecretMessage_pageId_status_createdAt_idx" ON "SecretMessage"("pageId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SecretMessage_pageId_senderTokenHash_createdAt_idx" ON "SecretMessage"("pageId", "senderTokenHash", "createdAt");

-- CreateIndex
CREATE INDEX "SecretMessage_campaignId_createdAt_idx" ON "SecretMessage"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "SecretBlock_pageId_createdAt_idx" ON "SecretBlock"("pageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecretBlock_pageId_senderTokenHash_key" ON "SecretBlock"("pageId", "senderTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "SecretPublicReply_messageId_key" ON "SecretPublicReply"("messageId");

-- CreateIndex
CREATE INDEX "LeaderboardPreference_weeklyXpEnabled_optedInAt_idx" ON "LeaderboardPreference"("weeklyXpEnabled", "optedInAt");

-- CreateIndex
CREATE INDEX "UserMediaDownloadPreference_updatedAt_idx" ON "UserMediaDownloadPreference"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUploadSession_tokenHash_key" ON "MediaUploadSession"("tokenHash");

-- CreateIndex
CREATE INDEX "MediaUploadSession_ownerId_expiresAt_consumedAt_idx" ON "MediaUploadSession"("ownerId", "expiresAt", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerId_status_createdAt_idx" ON "MediaAsset"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_conversationId_status_createdAt_idx" ON "MediaAsset"("conversationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_sha256_idx" ON "MediaAsset"("sha256");

-- CreateIndex
CREATE INDEX "MediaAccessGrant_granteeId_expiresAt_revokedAt_idx" ON "MediaAccessGrant"("granteeId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAccessGrant_assetId_granteeId_key" ON "MediaAccessGrant"("assetId", "granteeId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaDownloadGrant_tokenHash_key" ON "MediaDownloadGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "MediaDownloadGrant_assetId_userId_expiresAt_idx" ON "MediaDownloadGrant"("assetId", "userId", "expiresAt");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_emoji_idx" ON "MessageReaction"("messageId", "emoji");

-- CreateIndex
CREATE INDEX "MessageReaction_userId_updatedAt_idx" ON "MessageReaction"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AbuseEvent_actorId_action_createdAt_idx" ON "AbuseEvent"("actorId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AbuseEvent_actorId_contentHash_createdAt_idx" ON "AbuseEvent"("actorId", "contentHash", "createdAt");

-- CreateIndex
CREATE INDEX "AbuseEvent_decision_createdAt_idx" ON "AbuseEvent"("decision", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_targetType_targetId_action_reversedAt_expi_idx" ON "ModerationAction"("targetType", "targetId", "action", "reversedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "ModerationAction_actorId_createdAt_idx" ON "ModerationAction"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NexusAccountLink_knowMeUserId_key" ON "NexusAccountLink"("knowMeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "NexusAccountLink_nexusUserId_key" ON "NexusAccountLink"("nexusUserId");

-- CreateIndex
CREATE INDEX "NexusAccountLink_lastPlan_verifiedAt_idx" ON "NexusAccountLink"("lastPlan", "verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NexusIntegrationReceipt_requestId_key" ON "NexusIntegrationReceipt"("requestId");

-- CreateIndex
CREATE INDEX "NexusIntegrationReceipt_actorNexusUserId_createdAt_idx" ON "NexusIntegrationReceipt"("actorNexusUserId", "createdAt");

-- CreateIndex
CREATE INDEX "NexusIntegrationReceipt_actorKnowMeUserId_createdAt_idx" ON "NexusIntegrationReceipt"("actorKnowMeUserId", "createdAt");

-- CreateIndex
CREATE INDEX "NexusIntegrationReceipt_capabilityId_createdAt_idx" ON "NexusIntegrationReceipt"("capabilityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NexusIntegrationReceipt_capabilityId_idempotencyKey_key" ON "NexusIntegrationReceipt"("capabilityId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "NexusSocialConversation_conversationId_key" ON "NexusSocialConversation"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "NexusSocialConversation_ownerUserId_key" ON "NexusSocialConversation"("ownerUserId");

-- CreateIndex
CREATE INDEX "NexusSocialConversation_ownerUserId_createdAt_idx" ON "NexusSocialConversation"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NexusSocialReply_requestId_key" ON "NexusSocialReply"("requestId");

-- CreateIndex
CREATE INDEX "NexusSocialReply_conversationId_createdAt_idx" ON "NexusSocialReply"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "NexusSocialReply_invokingUserId_createdAt_idx" ON "NexusSocialReply"("invokingUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NexusSocialReply_conversationId_idempotencyKey_key" ON "NexusSocialReply"("conversationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "NexusSocialReply_conversationId_sourceMessageId_key" ON "NexusSocialReply"("conversationId", "sourceMessageId");

-- CreateIndex
CREATE INDEX "NotificationCenterPreference_digestMode_updatedAt_idx" ON "NotificationCenterPreference"("digestMode", "updatedAt");

-- CreateIndex
CREATE INDEX "NotificationCenterUserState_userId_archivedAt_dismissedAt_idx" ON "NotificationCenterUserState"("userId", "archivedAt", "dismissedAt");

-- CreateIndex
CREATE INDEX "NotificationCenterUserState_userId_snoozedUntil_idx" ON "NotificationCenterUserState"("userId", "snoozedUntil");

-- CreateIndex
CREATE INDEX "NotificationCenterActionReceipt_userId_createdAt_idx" ON "NotificationCenterActionReceipt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationCenterActionReceipt_notificationId_createdAt_idx" ON "NotificationCenterActionReceipt"("notificationId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationCenterDigestQueueItem_status_dueAt_idx" ON "NotificationCenterDigestQueueItem"("status", "dueAt");

-- CreateIndex
CREATE INDEX "NotificationCenterDigestQueueItem_processingToken_idx" ON "NotificationCenterDigestQueueItem"("processingToken");

-- CreateIndex
CREATE INDEX "NotificationCenterDigestQueueItem_userId_bucketKey_status_idx" ON "NotificationCenterDigestQueueItem"("userId", "bucketKey", "status");

-- CreateIndex
CREATE INDEX "NotificationCenterDigestBatch_createdAt_idx" ON "NotificationCenterDigestBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCenterDigestBatch_userId_bucketKey_key" ON "NotificationCenterDigestBatch"("userId", "bucketKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceProduct_key_key" ON "CommerceProduct"("key");

-- CreateIndex
CREATE INDEX "CommerceProduct_active_highlighted_kind_idx" ON "CommerceProduct"("active", "highlighted", "kind");

-- CreateIndex
CREATE INDEX "CommerceProduct_fulfillmentType_fulfillmentReference_idx" ON "CommerceProduct"("fulfillmentType", "fulfillmentReference");

-- CreateIndex
CREATE INDEX "CommercePrice_productId_active_platform_countryCode_currenc_idx" ON "CommercePrice"("productId", "active", "platform", "countryCode", "currency");

-- CreateIndex
CREATE INDEX "CommercePrice_provider_platform_active_idx" ON "CommercePrice"("provider", "platform", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePrice_provider_externalProductId_key" ON "CommercePrice"("provider", "externalProductId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_reference_key" ON "PaymentOrder"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_idempotencyKey_key" ON "PaymentOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentOrder_userId_status_createdAt_idx" ON "PaymentOrder"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_provider_status_expiresAt_idx" ON "PaymentOrder"("provider", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_productId_status_createdAt_idx" ON "PaymentOrder"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_status_createdAt_idx" ON "PaymentAttempt"("orderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_provider_status_createdAt_idx" ON "PaymentAttempt"("provider", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_provider_externalTransactionId_key" ON "PaymentAttempt"("provider", "externalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_provider_externalEventId_key" ON "PaymentAttempt"("provider", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_idempotencyKey_key" ON "PaymentRefund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentRefund_orderId_status_createdAt_idx" ON "PaymentRefund"("orderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentRefund_provider_status_createdAt_idx" ON "PaymentRefund"("provider", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_provider_externalRefundId_key" ON "PaymentRefund"("provider", "externalRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentInvoice_orderId_key" ON "PaymentInvoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentInvoice_number_key" ON "PaymentInvoice"("number");

-- CreateIndex
CREATE INDEX "PaymentInvoice_status_issuedAt_idx" ON "PaymentInvoice"("status", "issuedAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_provider_status_receivedAt_idx" ON "PaymentWebhookLog"("provider", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_payloadHash_idx" ON "PaymentWebhookLog"("payloadHash");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookLog_provider_externalEventId_key" ON "PaymentWebhookLog"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "PaymentFraudLog_status_severity_createdAt_idx" ON "PaymentFraudLog"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentFraudLog_userId_createdAt_idx" ON "PaymentFraudLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentFraudLog_orderId_createdAt_idx" ON "PaymentFraudLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentFraudLog_provider_type_createdAt_idx" ON "PaymentFraudLog"("provider", "type", "createdAt");

-- CreateIndex
CREATE INDEX "PositiveChallenge_creatorId_status_createdAt_idx" ON "PositiveChallenge"("creatorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PositiveChallenge_recipientId_status_createdAt_idx" ON "PositiveChallenge"("recipientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PositiveChallenge_expiresAt_status_idx" ON "PositiveChallenge"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PositiveChallenge_creatorId_recipientId_kind_challengeDate_key" ON "PositiveChallenge"("creatorId", "recipientId", "kind", "challengeDate");

-- CreateIndex
CREATE UNIQUE INDEX "PositiveChallengeEvent_idempotencyKey_key" ON "PositiveChallengeEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PositiveChallengeEvent_challengeId_createdAt_id_idx" ON "PositiveChallengeEvent"("challengeId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PositiveChallengeEvent_actorId_createdAt_idx" ON "PositiveChallengeEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "PrivacyPolicyVersion_key_locale_effectiveAt_retiredAt_idx" ON "PrivacyPolicyVersion"("key", "locale", "effectiveAt", "retiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyPolicyVersion_key_version_locale_key" ON "PrivacyPolicyVersion"("key", "version", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyConsentEvent_idempotencyKey_key" ON "PrivacyConsentEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PrivacyConsentEvent_userId_policyKey_occurredAt_id_idx" ON "PrivacyConsentEvent"("userId", "policyKey", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "PrivacyConsentEvent_policyKey_policyVersion_action_idx" ON "PrivacyConsentEvent"("policyKey", "policyVersion", "action");

-- CreateIndex
CREATE UNIQUE INDEX "DataSubjectRequest_idempotencyKey_key" ON "DataSubjectRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_userId_status_requestedAt_idx" ON "DataSubjectRequest"("userId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_status_dueAt_idx" ON "DataSubjectRequest"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataRetentionPolicy_key_key" ON "DataRetentionPolicy"("key");

-- CreateIndex
CREATE INDEX "DataRetentionPolicy_resourceType_enabled_idx" ON "DataRetentionPolicy"("resourceType", "enabled");

-- CreateIndex
CREATE INDEX "DataRetentionExecution_policyId_startedAt_idx" ON "DataRetentionExecution"("policyId", "startedAt");

-- CreateIndex
CREATE INDEX "DataRetentionExecution_status_startedAt_idx" ON "DataRetentionExecution"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ProfileCircleOwnershipTransfer_circleId_status_createdAt_idx" ON "ProfileCircleOwnershipTransfer"("circleId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileCircleOwnershipTransfer_toUserId_status_expiresAt_idx" ON "ProfileCircleOwnershipTransfer"("toUserId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ProfileCircleOwnershipTransfer_fromUserId_status_expiresAt_idx" ON "ProfileCircleOwnershipTransfer"("fromUserId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ProfileCircleMoment_circleId_status_audience_createdAt_idx" ON "ProfileCircleMoment"("circleId", "status", "audience", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileCircleMoment_authorUserId_createdAt_idx" ON "ProfileCircleMoment"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileCircleStory_circleId_status_audience_expiresAt_idx" ON "ProfileCircleStory"("circleId", "status", "audience", "expiresAt");

-- CreateIndex
CREATE INDEX "ProfileCircleStory_authorUserId_expiresAt_idx" ON "ProfileCircleStory"("authorUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "ProfileFamilyRelation_circleId_status_createdAt_idx" ON "ProfileFamilyRelation"("circleId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileFamilyRelation_firstUserId_status_idx" ON "ProfileFamilyRelation"("firstUserId", "status");

-- CreateIndex
CREATE INDEX "ProfileFamilyRelation_secondUserId_status_idx" ON "ProfileFamilyRelation"("secondUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileFamilyRelation_circleId_pairKey_key" ON "ProfileFamilyRelation"("circleId", "pairKey");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationChannelPreference_userId_optionalE_idx" ON "ProfileCircleNotificationChannelPreference"("userId", "optionalEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationChannelPreference_userId_channel_key" ON "ProfileCircleNotificationChannelPreference"("userId", "channel");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationProviderState_channel_circuitStatu_idx" ON "ProfileCircleNotificationProviderState"("channel", "circuitStatus", "nextProbeAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationProviderState_provider_channel_key" ON "ProfileCircleNotificationProviderState"("provider", "channel");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationSuppression_userId_channel_active_idx" ON "ProfileCircleNotificationSuppression"("userId", "channel", "active");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationSuppression_addressHash_active_idx" ON "ProfileCircleNotificationSuppression"("addressHash", "active");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationSuppression_active_expiresAt_idx" ON "ProfileCircleNotificationSuppression"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationRateBucket_windowEnd_idx" ON "ProfileCircleNotificationRateBucket"("windowEnd");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationTemplate_key_locale_channel_active_idx" ON "ProfileCircleNotificationTemplate"("key", "locale", "channel", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationTemplate_key_version_locale_channe_key" ON "ProfileCircleNotificationTemplate"("key", "version", "locale", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationDeadLetter_attemptId_key" ON "ProfileCircleNotificationDeadLetter"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationDeadLetter_idempotencyKey_key" ON "ProfileCircleNotificationDeadLetter"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationDeadLetter_status_availableAt_idx" ON "ProfileCircleNotificationDeadLetter"("status", "availableAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationDeadLetter_userId_channel_createdA_idx" ON "ProfileCircleNotificationDeadLetter"("userId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationWebhookReceipt_status_receivedAt_idx" ON "ProfileCircleNotificationWebhookReceipt"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationWebhookReceipt_attemptId_idx" ON "ProfileCircleNotificationWebhookReceipt"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationWebhookReceipt_provider_eventId_key" ON "ProfileCircleNotificationWebhookReceipt"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationOperationalAlert_fingerprint_key" ON "ProfileCircleNotificationOperationalAlert"("fingerprint");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationOperationalAlert_active_severity_l_idx" ON "ProfileCircleNotificationOperationalAlert"("active", "severity", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationSchedulerLease_leaseToken_key" ON "ProfileCircleNotificationSchedulerLease"("leaseToken");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationSchedulerLease_expiresAt_idx" ON "ProfileCircleNotificationSchedulerLease"("expiresAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationSchedulerLease_ownerId_expiresAt_idx" ON "ProfileCircleNotificationSchedulerLease"("ownerId", "expiresAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationEndpoint_userId_channel_status_idx" ON "ProfileCircleNotificationEndpoint"("userId", "channel", "status");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationEndpoint_status_lastSeenAt_idx" ON "ProfileCircleNotificationEndpoint"("status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationEndpoint_userId_channel_addressHas_key" ON "ProfileCircleNotificationEndpoint"("userId", "channel", "addressHash");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationTransportAttempt_idempotencyKey_key" ON "ProfileCircleNotificationTransportAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationTransportAttempt_status_nextAttemp_idx" ON "ProfileCircleNotificationTransportAttempt"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationTransportAttempt_userId_channel_cr_idx" ON "ProfileCircleNotificationTransportAttempt"("userId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationTransportAttempt_recipientId_idx" ON "ProfileCircleNotificationTransportAttempt"("recipientId");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationDigestSubscription_weeklyEnabled_w_idx" ON "ProfileCircleNotificationDigestSubscription"("weeklyEnabled", "weeklyDay", "minuteOfDay");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationDispatch_idempotencyKey_key" ON "ProfileCircleNotificationDispatch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationDispatch_circleId_createdAt_idx" ON "ProfileCircleNotificationDispatch"("circleId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationDispatch_actorUserId_createdAt_idx" ON "ProfileCircleNotificationDispatch"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationRecipient_userId_status_availableA_idx" ON "ProfileCircleNotificationRecipient"("userId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationRecipient_status_availableAt_proce_idx" ON "ProfileCircleNotificationRecipient"("status", "availableAt", "processingAt");

-- CreateIndex
CREATE INDEX "ProfileCircleNotificationRecipient_notificationId_idx" ON "ProfileCircleNotificationRecipient"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleNotificationRecipient_dispatchId_userId_key" ON "ProfileCircleNotificationRecipient"("dispatchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileExperience_publicShortCode_key" ON "ProfileExperience"("publicShortCode");

-- CreateIndex
CREATE INDEX "ProfileSectionVisibility_userId_audience_idx" ON "ProfileSectionVisibility"("userId", "audience");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileSectionVisibility_userId_section_key" ON "ProfileSectionVisibility"("userId", "section");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircle_slug_key" ON "ProfileCircle"("slug");

-- CreateIndex
CREATE INDEX "ProfileCircle_ownerUserId_status_idx" ON "ProfileCircle"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "ProfileCircle_type_status_level_idx" ON "ProfileCircle"("type", "status", "level");

-- CreateIndex
CREATE INDEX "ProfileCircleMember_userId_status_idx" ON "ProfileCircleMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleMember_circleId_userId_key" ON "ProfileCircleMember"("circleId", "userId");

-- CreateIndex
CREATE INDEX "ProfileCircleJoinRequest_circleId_status_createdAt_idx" ON "ProfileCircleJoinRequest"("circleId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileCircleJoinRequest_userId_status_createdAt_idx" ON "ProfileCircleJoinRequest"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleJoinRequest_circleId_userId_key" ON "ProfileCircleJoinRequest"("circleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCircleActivityEvent_idempotencyKey_key" ON "ProfileCircleActivityEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProfileCircleActivityEvent_circleId_occurredAt_idx" ON "ProfileCircleActivityEvent"("circleId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProfileCircleActivityEvent_actorUserId_occurredAt_idx" ON "ProfileCircleActivityEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProfileTimelineEvent_userId_happenedAt_idx" ON "ProfileTimelineEvent"("userId", "happenedAt");

-- CreateIndex
CREATE INDEX "ProfileMemoryVaultItem_userId_type_capturedAt_idx" ON "ProfileMemoryVaultItem"("userId", "type", "capturedAt");

-- CreateIndex
CREATE INDEX "ProfileWallPost_profileOwnerId_status_createdAt_idx" ON "ProfileWallPost"("profileOwnerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileWallPost_authorId_createdAt_idx" ON "ProfileWallPost"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileGiftShowcaseItem_userId_pinned_position_idx" ON "ProfileGiftShowcaseItem"("userId", "pinned", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileGiftShowcaseItem_userId_giftInstanceId_key" ON "ProfileGiftShowcaseItem"("userId", "giftInstanceId");

-- CreateIndex
CREATE INDEX "ProfileCaptureSecurityEvent_ownerUserId_createdAt_idx" ON "ProfileCaptureSecurityEvent"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileCaptureSecurityEvent_viewerUserId_createdAt_idx" ON "ProfileCaptureSecurityEvent"("viewerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileShareCard_shortCode_key" ON "ProfileShareCard"("shortCode");

-- CreateIndex
CREATE INDEX "ProfileCompatibilitySnapshot_firstUserId_secondUserId_idx" ON "ProfileCompatibilitySnapshot"("firstUserId", "secondUserId");

-- CreateIndex
CREATE INDEX "ProfileCompatibilitySnapshot_secondUserId_firstUserId_idx" ON "ProfileCompatibilitySnapshot"("secondUserId", "firstUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileStatEvent_idempotencyKey_key" ON "ProfileStatEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProfileStatEvent_userId_occurredAt_idx" ON "ProfileStatEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProfileStatEvent_userId_key_occurredAt_idx" ON "ProfileStatEvent"("userId", "key", "occurredAt");

-- CreateIndex
CREATE INDEX "ProfileStatEvent_sourceType_sourceId_idx" ON "ProfileStatEvent"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "UserProgression_level_totalXp_idx" ON "UserProgression"("level", "totalXp");

-- CreateIndex
CREATE UNIQUE INDEX "XpLedgerEntry_idempotencyKey_key" ON "XpLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "XpLedgerEntry_userId_createdAt_id_idx" ON "XpLedgerEntry"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "XpLedgerEntry_referenceType_referenceId_idx" ON "XpLedgerEntry"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "DailyQuestProgress_userId_questDate_idx" ON "DailyQuestProgress"("userId", "questDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuestProgress_userId_questKey_questDate_key" ON "DailyQuestProgress"("userId", "questKey", "questDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuestContribution_idempotencyKey_key" ON "DailyQuestContribution"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DailyQuestContribution_userId_questDate_idx" ON "DailyQuestContribution"("userId", "questDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuestContribution_userId_questKey_questDate_key" ON "DailyQuestContribution"("userId", "questKey", "questDate");

-- CreateIndex
CREATE INDEX "SavedMessage_userId_savedAt_idx" ON "SavedMessage"("userId", "savedAt");

-- CreateIndex
CREATE INDEX "SavedMessage_messageId_idx" ON "SavedMessage"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "ChallengeVersion_challengeId_createdAt_idx" ON "ChallengeVersion"("challengeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeVersion_challengeId_version_key" ON "ChallengeVersion"("challengeId", "version");

-- CreateIndex
CREATE INDEX "ChallengeQuestion_challengeId_version_idx" ON "ChallengeQuestion"("challengeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeQuestion_challengeId_version_position_key" ON "ChallengeQuestion"("challengeId", "version", "position");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_challengeId_challengeVersion_idx" ON "ChallengeParticipant"("challengeId", "challengeVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipant_challengeId_userId_key" ON "ChallengeParticipant"("challengeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeAnswer_participantId_questionId_key" ON "ChallengeAnswer"("participantId", "questionId");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_lastReadAt_idx" ON "ConversationMember"("userId", "lastReadAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetAccountId_createdAt_idx" ON "AuditLog"("targetAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAccount_userId_key" ON "StaffAccount"("userId");

-- CreateIndex
CREATE INDEX "StaffAccount_status_staffRole_idx" ON "StaffAccount"("status", "staffRole");

-- CreateIndex
CREATE INDEX "StaffAccount_activatedAt_idx" ON "StaffAccount"("activatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRole_key_key" ON "AccessRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserRoleGrant_userId_startsAt_expiresAt_revokedAt_idx" ON "UserRoleGrant"("userId", "startsAt", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "UserRoleGrant_roleId_startsAt_expiresAt_revokedAt_idx" ON "UserRoleGrant"("roleId", "startsAt", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "UserRoleGrant_source_externalReference_idx" ON "UserRoleGrant"("source", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "KnowCoinLedgerEntry_idempotencyKey_key" ON "KnowCoinLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "KnowCoinLedgerEntry_userId_createdAt_id_idx" ON "KnowCoinLedgerEntry"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "KnowCoinLedgerEntry_source_referenceType_referenceId_idx" ON "KnowCoinLedgerEntry"("source", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "RewardPolicy_eventType_enabled_startsAt_endsAt_idx" ON "RewardPolicy"("eventType", "enabled", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardPolicy_key_version_key" ON "RewardPolicy"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RewardEvent_idempotencyKey_key" ON "RewardEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RewardEvent_ledgerEntryId_key" ON "RewardEvent"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "RewardEvent_userId_status_createdAt_idx" ON "RewardEvent"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RewardEvent_eventType_entityType_entityId_idx" ON "RewardEvent"("eventType", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "RewardEvent_policyId_createdAt_idx" ON "RewardEvent"("policyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlan_key_key" ON "BillingPlan"("key");

-- CreateIndex
CREATE INDEX "BillingPlan_active_highlighted_idx" ON "BillingPlan"("active", "highlighted");

-- CreateIndex
CREATE INDEX "BillingPrice_planId_active_platform_countryCode_currency_idx" ON "BillingPrice"("planId", "active", "platform", "countryCode", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPrice_provider_externalPriceId_key" ON "BillingPrice"("provider", "externalPriceId");

-- CreateIndex
CREATE INDEX "BillingPlanEntitlement_key_idx" ON "BillingPlanEntitlement"("key");

-- CreateIndex
CREATE INDEX "BillingSubscription_userId_status_currentPeriodEnd_idx" ON "BillingSubscription"("userId", "status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "BillingSubscription_planId_status_idx" ON "BillingSubscription"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_provider_externalSubscriptionId_key" ON "BillingSubscription"("provider", "externalSubscriptionId");

-- CreateIndex
CREATE INDEX "BillingEvent_provider_status_receivedAt_idx" ON "BillingEvent"("provider", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "BillingEvent_subscriptionId_occurredAt_idx" ON "BillingEvent"("subscriptionId", "occurredAt");

-- CreateIndex
CREATE INDEX "BillingEvent_userId_occurredAt_idx" ON "BillingEvent"("userId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_provider_externalEventId_key" ON "BillingEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "IdentityVerificationRequest_userId_status_submittedAt_idx" ON "IdentityVerificationRequest"("userId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "IdentityVerificationRequest_status_submittedAt_idx" ON "IdentityVerificationRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "IdentityVerificationRequest_reviewerId_status_idx" ON "IdentityVerificationRequest"("reviewerId", "status");

-- CreateIndex
CREATE INDEX "IdentityVerificationRequest_expiresAt_status_idx" ON "IdentityVerificationRequest"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityVerificationRequest_userId_submissionNumber_key" ON "IdentityVerificationRequest"("userId", "submissionNumber");

-- CreateIndex
CREATE INDEX "IdentityEvidenceReference_requestId_createdAt_idx" ON "IdentityEvidenceReference"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityEvidenceReference_digest_idx" ON "IdentityEvidenceReference"("digest");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityEvidenceReference_provider_opaqueReference_key" ON "IdentityEvidenceReference"("provider", "opaqueReference");

-- CreateIndex
CREATE INDEX "IdentityVerificationDecision_requestId_createdAt_idx" ON "IdentityVerificationDecision"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityVerificationDecision_reviewerId_createdAt_idx" ON "IdentityVerificationDecision"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityVerificationDecision_nextStatus_createdAt_idx" ON "IdentityVerificationDecision"("nextStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_enabled_exposeToClient_idx" ON "FeatureFlag"("enabled", "exposeToClient");

-- CreateIndex
CREATE INDEX "FeatureFlagRule_flagId_priority_idx" ON "FeatureFlagRule"("flagId", "priority");

-- CreateIndex
CREATE INDEX "FeatureFlagOverride_userId_expiresAt_idx" ON "FeatureFlagOverride"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagOverride_flagId_userId_key" ON "FeatureFlagOverride"("flagId", "userId");

-- CreateIndex
CREATE INDEX "EntitlementGrant_userId_key_startsAt_expiresAt_revokedAt_idx" ON "EntitlementGrant"("userId", "key", "startsAt", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "EntitlementGrant_source_externalReference_idx" ON "EntitlementGrant"("source", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "Interest_name_key" ON "Interest"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Interest_slug_key" ON "Interest"("slug");

-- CreateIndex
CREATE INDEX "UserInterest_interestId_idx" ON "UserInterest"("interestId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInterest_userId_interestId_key" ON "UserInterest"("userId", "interestId");

-- CreateIndex
CREATE INDEX "CompatibilitySnapshot_userAId_userBId_createdAt_idx" ON "CompatibilitySnapshot"("userAId", "userBId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AccountSecurity_twoFactorEnabled_lockedUntil_idx" ON "AccountSecurity"("twoFactorEnabled", "lockedUntil");

-- CreateIndex
CREATE INDEX "SecurityRecoveryCode_userId_usedAt_idx" ON "SecurityRecoveryCode"("userId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityChallenge_tokenHash_key" ON "SecurityChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "SecurityChallenge_userId_purpose_expiresAt_consumedAt_idx" ON "SecurityChallenge"("userId", "purpose", "expiresAt", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_deviceTokenHash_key" ON "TrustedDevice"("deviceTokenHash");

-- CreateIndex
CREATE INDEX "TrustedDevice_userId_trustedUntil_revokedAt_idx" ON "TrustedDevice"("userId", "trustedUntil", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReauthenticationProof_tokenHash_key" ON "ReauthenticationProof"("tokenHash");

-- CreateIndex
CREATE INDEX "ReauthenticationProof_userId_sessionId_expiresAt_consumedAt_idx" ON "ReauthenticationProof"("userId", "sessionId", "expiresAt", "consumedAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_createdAt_id_idx" ON "SecurityEvent"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_severity_createdAt_idx" ON "SecurityEvent"("type", "severity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");

-- CreateIndex
CREATE INDEX "ShortLink_ownerId_createdAt_idx" ON "ShortLink"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ShortLink_targetKind_targetId_idx" ON "ShortLink"("targetKind", "targetId");

-- CreateIndex
CREATE INDEX "ShortLink_expiresAt_revokedAt_idx" ON "ShortLink"("expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "ShortLinkReceipt_createdAt_idx" ON "ShortLinkReceipt"("createdAt");

-- CreateIndex
CREATE INDEX "SocialMatchPreference_matchmakingEnabled_allowNewPeople_idx" ON "SocialMatchPreference"("matchmakingEnabled", "allowNewPeople");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMatchQueueEntry_userId_key" ON "SocialMatchQueueEntry"("userId");

-- CreateIndex
CREATE INDEX "SocialMatchQueueEntry_status_purpose_joinedAt_idx" ON "SocialMatchQueueEntry"("status", "purpose", "joinedAt");

-- CreateIndex
CREATE INDEX "SocialMatchQueueEntry_status_expiresAt_idx" ON "SocialMatchQueueEntry"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "SocialMatchProposal_firstUserId_status_updatedAt_idx" ON "SocialMatchProposal"("firstUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SocialMatchProposal_secondUserId_status_updatedAt_idx" ON "SocialMatchProposal"("secondUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SocialMatchProposal_status_expiresAt_idx" ON "SocialMatchProposal"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "SocialMatchDecision_userId_createdAt_idx" ON "SocialMatchDecision"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialMatchBlock_blockedId_createdAt_idx" ON "SocialMatchBlock"("blockedId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialMatchEvent_userId_action_createdAt_idx" ON "SocialMatchEvent"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "SocialMatchEvent_subjectId_action_createdAt_idx" ON "SocialMatchEvent"("subjectId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "SocialMatchReceipt_createdAt_idx" ON "SocialMatchReceipt"("createdAt");

-- CreateIndex
CREATE INDEX "SocialConnectionIntent_userId_status_expiresAt_idx" ON "SocialConnectionIntent"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "SocialConnectionIntent_status_expiresAt_idx" ON "SocialConnectionIntent"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "SocialConnectionOutcome_friendshipId_idx" ON "SocialConnectionOutcome"("friendshipId");

-- CreateIndex
CREATE INDEX "SocialConnectionOutcome_conversationId_idx" ON "SocialConnectionOutcome"("conversationId");

-- CreateIndex
CREATE INDEX "SocialConnectionEvent_userId_action_createdAt_idx" ON "SocialConnectionEvent"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "SocialConnectionEvent_proposalId_createdAt_idx" ON "SocialConnectionEvent"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialConnectionReceipt_createdAt_idx" ON "SocialConnectionReceipt"("createdAt");

-- CreateIndex
CREATE INDEX "UserActivityStreak_longestDays_currentDays_idx" ON "UserActivityStreak"("longestDays", "currentDays");

-- CreateIndex
CREATE UNIQUE INDEX "StreakActivityDay_idempotencyKey_key" ON "StreakActivityDay"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StreakActivityDay_userId_activityDate_idx" ON "StreakActivityDay"("userId", "activityDate");

-- CreateIndex
CREATE UNIQUE INDEX "StreakActivityDay_userId_activityDate_key" ON "StreakActivityDay"("userId", "activityDate");

-- CreateIndex
CREATE INDEX "Tournament_status_registrationClosesAt_idx" ON "Tournament"("status", "registrationClosesAt");

-- CreateIndex
CREATE INDEX "Tournament_ownerId_status_updatedAt_idx" ON "Tournament"("ownerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Tournament_gameDefinitionKey_gameDefinitionVersion_createdA_idx" ON "Tournament"("gameDefinitionKey", "gameDefinitionVersion", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_ownerId_creationKey_key" ON "Tournament"("ownerId", "creationKey");

-- CreateIndex
CREATE INDEX "TournamentEntrant_tournamentId_status_registeredAt_idx" ON "TournamentEntrant"("tournamentId", "status", "registeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEntrant_tournamentId_captainId_key" ON "TournamentEntrant"("tournamentId", "captainId");

-- CreateIndex
CREATE INDEX "TournamentEntrantMember_entrantId_status_createdAt_idx" ON "TournamentEntrantMember"("entrantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentEntrantMember_userId_status_updatedAt_idx" ON "TournamentEntrantMember"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentMatch_gameSessionId_key" ON "TournamentMatch"("gameSessionId");

-- CreateIndex
CREATE INDEX "TournamentMatch_tournamentId_status_round_position_idx" ON "TournamentMatch"("tournamentId", "status", "round", "position");

-- CreateIndex
CREATE INDEX "TournamentMatch_nextMatchId_idx" ON "TournamentMatch"("nextMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentMatch_tournamentId_round_position_key" ON "TournamentMatch"("tournamentId", "round", "position");

-- CreateIndex
CREATE INDEX "TournamentEvent_tournamentId_createdAt_idx" ON "TournamentEvent"("tournamentId", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentEvent_actorId_action_createdAt_idx" ON "TournamentEvent"("actorId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentEvent_subjectId_action_createdAt_idx" ON "TournamentEvent"("subjectId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentReceipt_createdAt_idx" ON "TournamentReceipt"("createdAt");

-- AddForeignKey
ALTER TABLE "AchievementGrant" ADD CONSTRAINT "AchievementGrant_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AchievementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptKAssetManifest" ADD CONSTRAINT "ConceptKAssetManifest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "ConceptKCharacterDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptKAssetDeliveryEvent" ADD CONSTRAINT "ConceptKAssetDeliveryEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ConceptKAssetManifest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticOwnership" ADD CONSTRAINT "CosmeticOwnership_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItemDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticEquipment" ADD CONSTRAINT "CosmeticEquipment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItemDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticPresetItem" ADD CONSTRAINT "CosmeticPresetItem_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "CosmeticPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticPresetItem" ADD CONSTRAINT "CosmeticPresetItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItemDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticPresetState" ADD CONSTRAINT "CosmeticPresetState_defaultPresetId_fkey" FOREIGN KEY ("defaultPresetId") REFERENCES "CosmeticPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticPresetState" ADD CONSTRAINT "CosmeticPresetState_activePresetId_fkey" FOREIGN KEY ("activePresetId") REFERENCES "CosmeticPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticPresetActivation" ADD CONSTRAINT "CosmeticPresetActivation_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "CosmeticPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticOfferDefinition" ADD CONSTRAINT "CosmeticOfferDefinition_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItemDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticPurchaseReceipt" ADD CONSTRAINT "CosmeticPurchaseReceipt_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CosmeticOfferDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticPurchaseReceipt" ADD CONSTRAINT "CosmeticPurchaseReceipt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItemDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretCampaign" ADD CONSTRAINT "SecretCampaign_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SecretPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretMessage" ADD CONSTRAINT "SecretMessage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SecretPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretMessage" ADD CONSTRAINT "SecretMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SecretCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretBlock" ADD CONSTRAINT "SecretBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SecretPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretPublicReply" ADD CONSTRAINT "SecretPublicReply_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SecretMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAccessGrant" ADD CONSTRAINT "MediaAccessGrant_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePrice" ADD CONSTRAINT "CommercePrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "CommercePrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInvoice" ADD CONSTRAINT "PaymentInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositiveChallengeEvent" ADD CONSTRAINT "PositiveChallengeEvent_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "PositiveChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRetentionExecution" ADD CONSTRAINT "DataRetentionExecution_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "DataRetentionPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCircleNotificationRecipient" ADD CONSTRAINT "ProfileCircleNotificationRecipient_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "ProfileCircleNotificationDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSectionVisibility" ADD CONSTRAINT "ProfileSectionVisibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ProfileExperience"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCircleMember" ADD CONSTRAINT "ProfileCircleMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "ProfileCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCircleJoinRequest" ADD CONSTRAINT "ProfileCircleJoinRequest_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "ProfileCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCircleActivityEvent" ADD CONSTRAINT "ProfileCircleActivityEvent_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "ProfileCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileTimelineEvent" ADD CONSTRAINT "ProfileTimelineEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ProfileExperience"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileWallPost" ADD CONSTRAINT "ProfileWallPost_profileOwnerId_fkey" FOREIGN KEY ("profileOwnerId") REFERENCES "ProfileExperience"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileGiftShowcaseItem" ADD CONSTRAINT "ProfileGiftShowcaseItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ProfileExperience"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeVersion" ADD CONSTRAINT "ChallengeVersion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeVersion" ADD CONSTRAINT "ChallengeVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeQuestion" ADD CONSTRAINT "ChallengeQuestion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeAnswer" ADD CONSTRAINT "ChallengeAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ChallengeParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeAnswer" ADD CONSTRAINT "ChallengeAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChallengeQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAccount" ADD CONSTRAINT "StaffAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleGrant" ADD CONSTRAINT "UserRoleGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleGrant" ADD CONSTRAINT "UserRoleGrant_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowCoinWallet" ADD CONSTRAINT "KnowCoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowCoinLedgerEntry" ADD CONSTRAINT "KnowCoinLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "RewardPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPrice" ADD CONSTRAINT "BillingPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlanEntitlement" ADD CONSTRAINT "BillingPlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "BillingPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityVerificationRequest" ADD CONSTRAINT "IdentityVerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityVerificationRequest" ADD CONSTRAINT "IdentityVerificationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityEvidenceReference" ADD CONSTRAINT "IdentityEvidenceReference_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "IdentityVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityVerificationDecision" ADD CONSTRAINT "IdentityVerificationDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "IdentityVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityVerificationDecision" ADD CONSTRAINT "IdentityVerificationDecision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagRule" ADD CONSTRAINT "FeatureFlagRule_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagOverride" ADD CONSTRAINT "FeatureFlagOverride_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagOverride" ADD CONSTRAINT "FeatureFlagOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

