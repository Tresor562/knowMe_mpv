import { Injectable } from '@nestjs/common';
import { sanitizeAffinityReplay } from './affinity-mirror.engine';

type RawReplay = {
  sessionId: string;
  definitionKey: string;
  definitionVersion: number;
  seed: string;
  initialState: unknown;
  finalState: unknown;
  result: unknown;
  participants: Array<{ userId: string; position: number }>;
  actions: Array<{
    sequence: number;
    actorId: string;
    actionType: string;
    payload: unknown;
    stateHashBefore: string;
    stateHashAfter: string;
    createdAt: Date;
  }>;
  checksum: string;
  verified: boolean;
  reproducible: boolean;
  economicStake: null;
};

@Injectable()
export class AffinityReplayPrivacyService {
  sanitize(replay: RawReplay) {
    if (replay.definitionKey !== 'affinity-mirror') return replay;
    const sanitized = sanitizeAffinityReplay({
      initialState: replay.initialState,
      finalState: replay.finalState,
      result: replay.result,
      actions: replay.actions
    });
    return {
      sessionId: replay.sessionId,
      definitionKey: replay.definitionKey,
      definitionVersion: replay.definitionVersion,
      seed: null,
      initialState: sanitized.initialState,
      finalState: sanitized.finalState,
      result: replay.result,
      participants: replay.participants,
      actions: sanitized.actions,
      checksum: replay.checksum,
      verified: replay.verified,
      verificationScope: 'SERVER',
      reproducible: sanitized.reproducibleByParticipant,
      interpretable: sanitized.interpretable,
      privacyRedacted: sanitized.privacyRedacted,
      detailedAnswersShared: sanitized.detailedAnswersShared,
      economicStake: null
    };
  }
}
